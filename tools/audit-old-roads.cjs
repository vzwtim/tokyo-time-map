'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,'dist',f),'utf8');
const packed=[...JSON.parse(read('old-roads.json')),...JSON.parse(read('old-roads-extra.json'))];
const audit=JSON.parse(read('old-roads-audit.json'));
const context=vm.createContext({packed,audit,console});
vm.runInContext(read('engine.js')+read('road-routing.js')+`
 const roads=mergeRoadEntries(packed).map(([id,name,paths,stops])=>({id,name,paths:paths.map(p=>p.map(([lon,lat])=>xy({lon,lat}))),stops:stops.map(([name,serial,region,lon,lat,hub,meta={}])=>({name,serial,region,hub,meta,point:xy({lon,lat})}))}));
 const graph=buildRoadGraph(roads);
 for(const road of roads){
  const row=audit.roads.find(row=>row.id===road.id);row.gaps=[];
  for(const [pi,entry] of road.routingPaths.entries()){
   // Review visible geographic posts on each path, not only the one selected by
   // routing when the same post sits on two overlapping branches.
   const near=[];
   for(const stop of road.stops){
    let best=Infinity,along=0;
    for(let i=1;i<entry.points.length;i++){
     const a=entry.points[i-1],b=entry.points[i],dx=b[0]-a[0],dy=b[1]-a[1];
     const t=Math.min(1,Math.max(0,((stop.point[0]-a[0])*dx+(stop.point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
     const error=roadDistance(stop.point,[a[0]+dx*t,a[1]+dy*t]);
     if(error<best){best=error;along=entry.lengths[i-1]+(entry.lengths[i]-entry.lengths[i-1])*t;}
    }
    if(best<.02)near.push({name:stop.name,along});
   }
   near.sort((a,b)=>a.along-b.along);
   const edge=[{name:'線の始点',along:0},...near,{name:'線の終点',along:entry.lengths.at(-1)}];
   for(let i=1;i<edge.length;i++){
    const km=edge[i].along-edge[i-1].along;if(km<20)continue;
    const ferry=road.id==='R001'&&[edge[i-1].name,edge[i].name].includes('桑名')&&[edge[i-1].name,edge[i].name].includes('宮');
    row.gaps.push({path:pi,from:edge[i-1].name,to:edge[i].name,km:Math.round(km*10)/10,classification:ferry?'渡海（七里の渡し）':road.id==='R002'?'峠越え（和田峠）':'公表宿場リストが疎な区間・別経路',note:ferry?'海上に宿場を追加しない':'中間の全宿場が確定したことを意味しない。未確認の宿場名は追加せず、根拠のある経由地だけ補充。'});
   }
  }
  row.unsnapped=road.stops.filter(s=>!s.snap).length;
  row.orphaned=road.stops.filter(s=>!graph.edges[s.index].length).length;
 }
`,context);
audit.summary={roads:audit.roads.length,previousPoints:audit.roads.reduce((sum,r)=>sum+r.postsBefore,0),points:audit.roads.reduce((sum,r)=>sum+r.pointsAfter,0),beforeOver150m:audit.roads.flatMap(r=>r.before).filter(s=>s.offsetKm>.15).length,afterOver10m:audit.roads.flatMap(r=>r.after).filter(s=>s.offsetKm>.01).length,orphaned:audit.roads.reduce((sum,r)=>sum+r.orphaned,0)};
fs.writeFileSync(path.join(root,'dist/old-roads-audit.json'),JSON.stringify(audit)+'\n');
const s=audit.summary;
let md=`# 旧街道 全路線点検記録\n\n点検対象：${s.roads}街道、元データ${s.previousPoints}地点。補充後${s.points}地点。\n\n- 宿場の公表座標は保持し、街道の概略線を局所補正。元の座標系で150m以上離れていたもの${s.beforeOver150m}件。補正後10m超のずれ${s.afterOver10m}件、経路グラフから孤立した収録地点${s.orphaned}件。\n- これは線と点の整合性の検査であり、歴史的な全宿場を網羅した証明ではありません。\n- 宿場・継立場、茶屋、門、城下、峠、分岐、経由地を区別。追加経由地は概略位置で、宿場に数えません。\n- 時間距離による地形変形はありません。線形の補完・局所補正は概略表現です。\n\n## 各街道\n\n|街道|元の地点数|補充後|150m超のずれ（補正前）|孤立地点（補正後）|\n|---|---:|---:|---:|---:|\n`;
for(const r of audit.roads)md+=`|${r.name}|${r.postsBefore}|${r.pointsAfter}|${r.before.filter(s=>s.offsetKm>.15).length}|${r.orphaned}|\n`;
md+='\n## 20km以上の間隔を持つ区間\n\n線の端から最初の地点までの空白、支路も含めて検出。以下は削除して隠していません。宿場データの範囲と街道線の範囲の差、海路、長い峠道、別経路を混同せずに残します。未確認の中間宿を捏造して埋めることはしません。\n\n|街道|区間|概略km|判定・取り扱い|\n|---|---|---:|---|\n';
for(const r of audit.roads)for(const g of r.gaps)md+=`|${r.name}|${g.from}〜${g.to}|${g.km}|${g.classification}|\n`;
md+='\n## 資料\n\n';for(const v of Object.values(audit.sources))md+=`- [${v.title}](${v.url})\n`;
md+='- 七里の渡し：[名古屋市熱田区](https://www.city.nagoya.jp/atsuta/miryoku/1022287/1022299/1022302.html)\n- 和田峠：[日本山岳会 山岳古道120選](https://kodo.jac1.or.jp/kodo120selections/number_67/)\n\n## 再生成\n\n元データ固定版から `python tools/repair-old-roads.py`、続けて `node tools/audit-old-roads.cjs` で再生成。地点ごとの補正前後の距離と全長区間は [JSON](old-roads-audit.json) に収録。\n';
fs.writeFileSync(path.join(root,'dist/old-roads-audit.md'),md);console.log(JSON.stringify(s));
