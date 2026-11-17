'use strict';
const $=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let origin=S['新宿'],mode='rail',express=true,shinkansen=true,mix=1,zoom=1,pan=[0,0],selected=null,hover=null,result,warp,W=0,H=0,dpr=1,animation=null,frame=0,points=[],lastScreen=[],stationIndex=[],drawLabels=[],ringTargets=[],selectedMinute=30,hoverMinute=null;
let rentLayer=null,layerMode=0,rentTab='stations',rentPromise=null,viewMotion=null,terrainDepth=0,layerRequest=0;
let yaw=0,pitch=.72,rentOpacity=.75,walkCorrection=true,modelRevision=0,profileLine=null,profileStation=null,orbit=null;
function viewDepth(now=performance.now()){if(!viewMotion)return terrainDepth;const t=Math.max(0,Math.min(1,(now-viewMotion.start)/650));return viewMotion.from+(terrainDepth-viewMotion.from)*(1-Math.cos(Math.PI*t))/2;}
function set3D(enabled){const from=viewDepth();terrainDepth=enabled?1:0;viewMotion=reduced?null:{from,start:performance.now()};$('view3d').setAttribute('aria-pressed',enabled);$('view3d').classList.toggle('active',enabled);$('view3d').textContent=enabled?'2D':'3D';$('view3d').setAttribute('aria-label',enabled?'平面表示に戻す':'3D表示に切り替える');requestDraw();}
function sceneProjection(now=performance.now()){const depth=viewDepth(now),angle=yaw*depth,tilt=pitch*depth,c=Math.cos(angle),s=Math.sin(angle),cp=Math.cos(tilt),sp=Math.sin(tilt),base=baseScreen(),camera=currentPan(now),scale=17*zoom;return (p,height=0)=>[base[0]+(p[0]*c-p[1]*s)*scale+camera[0],base[1]+((p[0]*s+p[1]*c)*cp-height*sp)*scale+camera[1]+depth*35];}
const geoXY=(p)=>xy({lon:p[0],lat:p[1]});
function addPoint(p){points.push({geo:p,target:p,from:p});return points.length-1;}
function densify(raw,step=.8){let out=[];for(let i=0;i<raw.length;i++){let p=geoXY(raw[i]);if(i){let q=geoXY(raw[i-1]),n=Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/step);for(let j=1;j<n;j++)out.push(addPoint([q[0]+(p[0]-q[0])*j/n,q[1]+(p[1]-q[1])*j/n]));}out.push(addPoint(p));}return out;}
const coast=densify([...GEOGRAPHY.bay,GEOGRAPHY.bay[0]],1.5),rivers=GEOGRAPHY.rivers.map(r=>({...r,ids:densify(r.points)})),parks=GEOGRAPHY.parks.map(p=>({...p,ids:densify([...p.points,p.points[0]])}));
const regionCoast=typeof RAIL_GEODATA==='undefined'?[]:RAIL_GEODATA.coast.map(ring=>densify(ring,8));
const linePaths=LINES.map(l=>l.edges||l.express?null:densify(l.stops.map(i=>[STATIONS[i].lon,STATIONS[i].lat]),1.1));
const regionalPaths=LINES.flatMap((l,i)=>{
 if(!l.edges||l.express||(l.bullet&&l.edges.some(e=>e.dir===1)&&!l.name.endsWith('こだま')))return [];
 const directed=l.edges.some(e=>e.dir===1);
 return l.edges.filter(e=>e.dir===0&&(directed||e.from<e.to))
  .map(e=>({line:i,from:e.from,to:e.to}));
});
const grids=[];for(let x=-48;x<=50;x+=4){let ids=[];for(let y=-34;y<=42;y+=2)ids.push(addPoint([x,y]));grids.push(ids);}for(let y=-34;y<=42;y+=4){let ids=[];for(let x=-48;x<=50;x+=2)ids.push(addPoint([x,y]));grids.push(ids);}
stationIndex=STATIONS.map(s=>addPoint(xy(s)));
const major=['新宿','代々木上原','下北沢','渋谷','池袋','東京','品川','上野','浅草','押上','錦糸町','吉祥寺','三鷹','立川','八王子','町田','新百合ヶ丘','調布','所沢','大宮','浦和','赤羽','横浜','川崎','武蔵小杉','二子玉川','豊洲','新木場','北千住','船橋','千葉','浦安','羽田空港','成城学園前','恵比寿','四ツ谷','飯田橋','六本木','銀座','清澄白河','東陽町','綾瀬','国分寺','三軒茶屋'];
const majorStations=new Set([...major,...(typeof HIGHLIGHTS==='undefined'?[]:HIGHLIGHTS)].map(n=>S[n]).filter(Number.isInteger));
const landmarkIds=[addPoint(geoXY([139.85,35.58])),addPoint(geoXY([139.706,35.778])),addPoint(geoXY([139.54,35.68]))];
function progress(now){if(!animation)return 1;const t=Math.max(0,Math.min(1,(now-animation.start)/animation.duration));return (1-Math.cos(Math.PI*t))/2;}
function currentPoint(p,now=performance.now()){const t=progress(now);return [p.from[0]+(p.target[0]-p.from[0])*t,p.from[1]+(p.target[1]-p.from[1])*t];}
function currentPan(now=performance.now()){if(!animation)return [...pan];const t=progress(now);return animation.panFrom.map((v,i)=>v+(pan[i]-v)*t);}
function settleMotion(){if(!animation)return;const now=performance.now(),c=currentPan(now),remaining=animation?Math.max(150,animation.duration-(now-animation.start)):0;for(const p of points)p.from=currentPoint(p,now);pan=c;if(animation)animation={start:performance.now(),duration:remaining,panFrom:c};}
function startMotion(camera,animate,duration=1050){if(animate&&!reduced)animation={start:performance.now(),duration,panFrom:camera};else{animation=null;for(const p of points)p.from=[...p.target];}}
function updateModel(animate=true,recenter=false){const now=performance.now(),camera=currentPan(now);for(const p of points)p.from=currentPoint(p,now);pan=recenter?[0,0]:camera;modelRevision++;result=calculate(origin,mode,express,shinkansen);warp=makeWarp(origin,result);const stationLookup=new Map(stationIndex.map((id,j)=>[id,j]));for(let i=0;i<points.length;i++){const p=points[i],station=stationLookup.get(i)??-1;const t=station>=0?warp.station(station):warp.point(p.geo);p.warped=t;p.target=[p.geo[0]-warp.base[0]+(t[0]-p.geo[0])*mix,p.geo[1]-warp.base[1]+(t[1]-p.geo[1])*mix];}
 $('originName').textContent=STATIONS[origin].name;updateCards();if(selected!==null)showDestination(selected,rentPanelActive);$('announce').textContent=STATIONS[origin].name+'を中心に地図を更新しました。';startMotion(camera,animate);requestDraw();}
function changeMix(v,animate=false){const now=performance.now(),camera=currentPan(now);for(const p of points)p.from=currentPoint(p,now);pan=camera;mix=v;modelRevision++;$('warpSlider').value=Math.round(v*100);$('warpSlider').style.setProperty('--pct',v*100+'%');$('geoBtn').classList.toggle('active',v<.5);$('timeBtn').classList.toggle('active',v>=.5);$('geoBtn').setAttribute('aria-pressed',v<.5);$('timeBtn').setAttribute('aria-pressed',v>=.5);for(const p of points){const t=p.warped;p.target=[p.geo[0]-warp.base[0]+(t[0]-p.geo[0])*mix,p.geo[1]-warp.base[1]+(t[1]-p.geo[1])*mix];}startMotion(camera,animate,900);requestDraw();}
function baseScreen(){return [W/2,H/2];}
function project(p,now=performance.now()){return sceneProjection(now)(p);}
function appendPath(ids,close=false,simplify=0){
 let previous=null;
 for(const id of ids){
  const p=lastScreen[id];
  if(!previous){ctx.moveTo(...p);previous=p;}
  else if(!simplify||(p[0]-previous[0])**2+(p[1]-previous[1])**2>=simplify**2){
   ctx.lineTo(...p);previous=p;
  }
 }
 if(close)ctx.closePath();
}
function path(ids,close=false){ctx.beginPath();appendPath(ids,close);}

const regionalPaint={
  rail:'#819c8c',
  bullet:'#cf8b55',
  unreachable:'#a4b3ac',
};
let overviewTracks=null;
function drawRegionalLines(projection){
 const wide=zoom<.12;
 const cached=wide&&!animation&&!(rentLayer&&layerMode&&viewDepth()>.001)&&typeof Path2D!=='undefined';
 const batches=new Map();
 const batch=(kind,color)=>{
  const key=kind+':'+color;
  if(!batches.has(key))batches.set(key,{kind,color,path:cached?new Path2D():[]});
  return batches.get(key).path;
 };
 if(cached&&overviewTracks?.revision===modelRevision){
  for(const entry of overviewTracks.batches)batches.set(...entry);
 }else{
  for(const {line,from,to} of regionalPaths){
   const l=LINES[line];if(l.bullet&&!shinkansen)continue;
   const a=cached?points[stationIndex[from]].target:lastScreen[stationIndex[from]];
   const b=cached?points[stationIndex[to]].target:lastScreen[stationIndex[to]];
   if(!cached&&(Math.max(a[0],b[0])<-10||Math.min(a[0],b[0])>W+10||
     Math.max(a[1],b[1])<-10||Math.min(a[1],b[1])>H+10))continue;
   const reachable=Number.isFinite(result.best[from].time)&&Number.isFinite(result.best[to].time);
   const kind=reachable?(l.bullet?'bullet':'rail'):'unreachable';
   const color=wide||!reachable?regionalPaint[kind]:l.color;
   const paths=batch(kind,color);
   if(cached){paths.moveTo(...a);paths.lineTo(...b);}
   else paths.push(a,b);
  }
  if(cached)overviewTracks={revision:modelRevision,batches:[...batches]};
 }
 const scale=17*zoom;
 if(cached){
  const a=projection([0,0]),x=projection([1,0]),y=projection([0,1]);
  ctx.save();ctx.transform(x[0]-a[0],x[1]-a[1],y[0]-a[0],y[1]-a[1],a[0],a[1]);
 }
 const unit=cached?1/scale:1;
 for(const {kind,color,path:line} of batches.values()){
  ctx.strokeStyle=color;
  ctx.lineWidth=(kind==='bullet'?(wide?1.25:2):(wide?.65:1.15))*unit;
  ctx.globalAlpha=kind==='bullet'?.75:kind==='unreachable'?.38:selected===null?.57:.2;
  ctx.setLineDash(kind==='bullet'?[4*unit,3*unit]:[]);
  if(cached)ctx.stroke(line);
  else{
   ctx.beginPath();
   for(let i=0;i<line.length;i+=2){ctx.moveTo(...line[i]);ctx.lineTo(...line[i+1]);}
   ctx.stroke();
  }
 }
 if(cached)ctx.restore();
 ctx.setLineDash([]);ctx.globalAlpha=1;
}
function visible(p,margin=50){return p[0]>-margin&&p[0]<W+margin&&p[1]>-margin&&p[1]<H+margin;}
function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
function draw(now){frame=0;advanceWheelZoom(now);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#f1efe7';ctx.fillRect(0,0,W,H);const ease=progress(now),scale=17*zoom,depth=viewDepth(now),projection=sceneProjection(now),world=animation?points.map(p=>[p.from[0]+(p.target[0]-p.from[0])*ease,p.from[1]+(p.target[1]-p.from[1])*ease]):points.map(p=>p.target);lastScreen=world.map(p=>projection(p));
 if(rentLayer&&layerMode)rentLayer.prepare(stationIndex.map(i=>world[i]),modelRevision+':'+(animation?animation.start:'settled')+':'+walkCorrection,now,!!animation,walkCorrection);
 if(regionCoast.length){
  ctx.fillStyle='#dbe7e4';ctx.fillRect(0,0,W,H);
  ctx.beginPath();
  for(const ids of regionCoast)appendPath(ids,true,zoom<.12?.85:0);
  ctx.fillStyle='#f1efe7';ctx.fill();ctx.strokeStyle='#aabfb6';ctx.lineWidth=.9;ctx.stroke();
 }
 ctx.strokeStyle='#d8dbd0';ctx.lineWidth=.55;ctx.globalAlpha=.6;for(const ids of grids){path(ids);ctx.stroke();}ctx.globalAlpha=1;
 if(!regionCoast.length){path(coast,true);ctx.fillStyle='#dbe7e4';ctx.fill();ctx.strokeStyle='#c7d8d2';ctx.lineWidth=.9;ctx.stroke();}
 for(const park of parks){path(park.ids,true);ctx.fillStyle='#dce3d4';ctx.fill();}
 for(const river of rivers){path(river.ids);ctx.strokeStyle='#c6dcd6';ctx.lineWidth=river.name==='荒川'?4:2.5;ctx.lineJoin='round';ctx.stroke();}
 if(rentLayer&&layerMode){rentLayer.draw(ctx,projection,depth,rentOpacity);if(depth>.001){for(const ids of linePaths)if(ids)for(const id of ids)lastScreen[id]=projection(world[id],rentLayer.elevation(world[id]));for(let i=0;i<STATIONS.length;i++){const id=stationIndex[i],r=rentLayer.observed[i];lastScreen[id]=projection(world[id],r?rentLayer.height(r.rent):rentLayer.elevation(world[id]));}}}
 const b=lastScreen[stationIndex[origin]],ringBase=projection(world[stationIndex[origin]],0),ringY=Math.cos(pitch*depth);ringTargets=[];if(mix>.97){let lastRadius=0;for(const min of (zoom<.27?[60,120,180,240,360,480,600,720,960,1200]:[10,20,30,40,50,60,70,80,90])){const r=min*.353*17*zoom,active=selectedTimeRing(min),hot=min===hoverMinute;if(r>Math.hypot(W,H)*1.5)break;if(zoom<.27&&r-lastRadius<34)continue;lastRadius=r;ctx.globalAlpha=active?.95:.55;ctx.setLineDash(active?[]:[2,5]);ctx.lineWidth=active?1.6:hot?1.3:.7;ctx.strokeStyle=active?'#327b78':hot?'#628f82':'#88a69d';ctx.beginPath();ctx.ellipse(ringBase[0],ringBase[1],r,r*ringY,0,0,Math.PI*2);ctx.stroke();ringTargets.push({minute:min,center:ringBase,radius:r,yScale:ringY,rect:null});
 // Labels follow the ring, with a clear touch target away from the center.
 const label=min>=60&&min%60===0?(min/60)+'時間':min+'分';
 ctx.font='11px system-ui, sans-serif';
 const width=Math.ceil(ctx.measureText(label).width)+12;
 for(const angle of [-.22,.22,.78,-.78,.5,-.5]){
  const x=ringBase[0]+Math.cos(Math.PI*angle)*r,y=ringBase[1]+Math.sin(Math.PI*angle)*r*ringY;
  const box=[x-width/2,y-9,width,18];
  if(box[0]<6||box[0]+width>W-6||box[1]<6||box[1]+18>H-6)continue;
  if(ringTargets.some(({rect:q})=>q&&box[0]<q[0]+q[2]+4&&box[0]+width>q[0]-4&&box[1]<q[1]+q[3]+3&&box[1]+18>q[1]-3))continue;
  ringTargets.at(-1).rect=box;
  break;
 }}
 ctx.setLineDash([]);ctx.globalAlpha=1;}

 for(let li=0;li<LINES.length;li++){if(!linePaths[li])continue;path(linePaths[li]);ctx.strokeStyle=LINES[li].color;ctx.lineWidth=mode==='walk'? .7:1.45;ctx.globalAlpha=selected===null?(mode==='walk'?.24:.65):.22;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}ctx.globalAlpha=1;
 drawRegionalLines(projection);
 if(selected!==null){const steps=result.route(selected);for(const step of steps){const a=lastScreen[stationIndex[step.from]],b=lastScreen[stationIndex[step.to]];ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineWidth=3.5;ctx.strokeStyle=step.type==='rail'?LINES[step.line].color:'#263b41';if(step.type==='walk')ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);}}
 const overview=zoom<.12;
 const markerIds=overview?majorStations:STATIONS.keys();
 function drawStationMarker(i){
  const p=lastScreen[stationIndex[i]];
  if(!p||!visible(p)||i===origin)return;
  ctx.beginPath();ctx.arc(...p,i===selected||i===hover?4:zoom<.27?1:1.8,0,Math.PI*2);
  ctx.fillStyle=i===selected?'#d86236':!Number.isFinite(result.best[i].time)?'#cbd2cb':layerMode&&rentLayer?.observed[i]?rentLayer.color(rentLayer.observed[i].rent):'#f8f7f1';
  ctx.fill();ctx.strokeStyle=i===selected?'#d86236':'#718a7e';ctx.lineWidth=.7;ctx.stroke();
 }
 for(const id of markerIds)drawStationMarker(id);
 if(overview&&selected!==null&&!majorStations.has(selected))drawStationMarker(selected);
 if(layerMode&&rentLayer&&depth>.01){const id=hover??selected??origin,r=rentLayer.observed[id];if(r){const a=projection(world[stationIndex[id]],0),b=lastScreen[stationIndex[id]];ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle='#725b4980';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(...b,4,0,Math.PI*2);ctx.fillStyle=rentLayer.color(r.rent);ctx.fill();}}
 const sea=lastScreen[landmarkIds[0]];if(zoom>.28&&visible(sea)){ctx.save();ctx.translate(...sea);ctx.rotate(-.12);ctx.fillStyle='#98b4ac';ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText('T O K Y O   B A Y',0,0);ctx.restore();}
 drawLabels=[];const candidates=[origin,...(selected!==null?[selected]:[]),...(hover!==null?[hover]:[]),...majorStations,...(zoom<.27?[]:STATIONS.map(s=>s.id))];const used=new Set();ctx.font='10px Arial, sans-serif';for(const i of candidates){if(used.has(i))continue;used.add(i);const p=lastScreen[stationIndex[i]];if(!visible(p,0)||p[1]>H-15)continue;let name=STATIONS[i].name,w=ctx.measureText(name).width;let x=p[0]+7,y=p[1]-7;
 if(x+w>W-5||y<11)continue;
 let box=[x-3,y-10,w+6,16];if(i!==origin&&i!==selected&&i!==hover&&drawLabels.some(q=>box[0]<q[0]+q[2]+3&&box[0]+box[2]>q[0]-3&&box[1]<q[1]+q[3]+3&&box[1]+box[3]>q[1]-3))continue;
 ctx.font=(i===origin||i===selected?'bold 11':'10')+'px system-ui, sans-serif';
 ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#f7f6ef';ctx.strokeText(name,x,y+2);
 ctx.fillStyle=i===origin||i===selected?'#a74325':'#30483e';ctx.fillText(name,x,y+2);
 ctx.font='10px Arial, sans-serif';box.id=i;drawLabels.push(box);}
 if(visible(b)){ctx.beginPath();ctx.arc(...b,12,0,Math.PI*2);ctx.fillStyle='#d8623620';ctx.fill();ctx.beginPath();ctx.arc(...b,5,0,Math.PI*2);ctx.fillStyle='#d86236';ctx.fill();ctx.strokeStyle='#f8f7f1';ctx.lineWidth=2;ctx.stroke();}
 for(const ring of ringTargets){
  if(!ring.rect)continue;
  const [x,y,w,h]=ring.rect,active=selectedTimeRing(ring.minute);
  const label=ring.minute>=60&&ring.minute%60===0?(ring.minute/60)+'時間':ring.minute+'分';
  ctx.globalAlpha=1;ctx.fillStyle=active?'#246660':'#f7f6ef';
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle=active?'#fff':'#42695f';ctx.font='11px system-ui, sans-serif';
  ctx.fillText(label,x+6,y+13);
 }
 if(mix<.99){const pxPerKm=17*zoom, unit=10**Math.floor(Math.log10(80/pxPerKm)), distance=[5,2,1].map(m=>m*unit).find(k=>k*pxPerKm<=100)??unit, len=distance*pxPerKm,x=18,y=H-(typeof sheetLevel==='number'?93:17);ctx.globalAlpha=1-mix;ctx.strokeStyle='#65766e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);ctx.moveTo(x,y);ctx.lineTo(x+len,y);ctx.moveTo(x+len,y-3);ctx.lineTo(x+len,y+3);ctx.stroke();ctx.fillStyle='#65766e';ctx.font='9px Arial';ctx.fillText(distance+' km',x,y-7);ctx.globalAlpha=1;}
 if(typeof drawDeviceLocation==='function')drawDeviceLocation(projection);
 if(viewMotion){if(now-viewMotion.start<650)requestDraw();else viewMotion=null;}
 if(animation){if(now-animation.start<animation.duration)requestDraw();else{animation=null;for(const p of points)p.from=p.target;if(layerMode)requestDraw();}}
}
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);requestDraw();}
function selectOrigin(id){if(id===undefined||id===origin)return;wheelZoom=null;clearTimeout(tapTimer);tapTimer=null;lastTap=null;selected=null;hover=null;hoverMinute=null;$('tip').hidden=true;$('destinationCard').hidden=true;origin=id;profileStation=null;profileLine=null;updateModel(true,true);updateSumuLink();}
function selectedTimeRing(minute){return layerMode ? minute>=rentFrom&&minute<=rentTo : minute===selectedMinute;}
function chooseMinute(minute){if(layerMode){const span=rentTo-rentFrom;rentFrom=Math.max(0,Math.min(90-span,minute-span/2));rentFrom=Math.round(rentFrom/10)*10;rentTo=rentFrom+span;syncRentRange();rentPanelActive=true;updateRentCards();requestDraw();return;}selectedMinute=minute;selected=null;$('destinationCard').hidden=true;hoverMinute=null;if(mix<.98)changeMix(1,true);updateCards();$('announce').textContent=STATIONS[origin].name+'から'+minute+'分前後の駅を表示しました。';requestDraw();}
function suggestionStations(){const tolerance=selectedMinute<=30?3:4;return STATIONS.filter(s=>s.id!==origin&&Math.abs(result.best[s.id].time-selectedMinute)<=tolerance).sort((a,b)=>Math.abs(result.best[a.id].time-selectedMinute)-Math.abs(result.best[b.id].time-selectedMinute)||km(STATIONS[origin],b)-km(STATIONS[origin],a));}
function routeChangeLabel(id){const stats=result.summary(id);return stats.transfers?'乗換 '+stats.transfers+'回':stats.through?'直通・乗換なし':'乗換なし';}
function arrivalLineMark(id){
 const step=result.route(id).findLast(s=>s.type==='rail');
 if(!step)return null;
 const line=LINES[step.line],mark=document.createElement('span');
 mark.className='station-line-mark';
 mark.style.setProperty('--line-color',line.color);
 mark.title=line.name;
 mark.setAttribute('role','img');
 mark.setAttribute('aria-label',line.name);
 return mark;
}
function updateCards(){
 if(layerMode&&rentLayer){updateRentCards();return;}
 const matches=suggestionStations(),tol=selectedMinute<=30?3:4,list=$('placeCards');
 $('placesTitle').textContent=selectedMinute+'分前後の駅';
 $('suggestionMeta').textContent=STATIONS[origin].name+'から ±'+tol+'分 · '+matches.length+'駅';
 list.replaceChildren();
 for(const station of matches){
  const button=document.createElement('button'),name=document.createElement('span');
  button.className='place';button.dataset.station=station.id;
  name.className='station-name';
  const mark=arrivalLineMark(station.id);
  if(mark)name.append(mark);
  name.append(station.name);
  const transfer=document.createElement('span');
  transfer.className='comparison';transfer.textContent=routeChangeLabel(station.id);
  const minutes=document.createElement('span'),unit=document.createElement('small');
  minutes.className='mins';
  minutes.textContent=Math.round(result.best[station.id].time);
  unit.textContent='分';minutes.append(unit);
  button.append(name);button.append(transfer);button.append(minutes);
  button.addEventListener('click',()=>showDestination(station.id));
  list.append(button);
 }
 list.classList.toggle('profile-cards',false);
 $('profileCaption').hidden=true;$('profileLines').hidden=true;
 $('timeChoices').hidden=false;
 if(!matches.length){
  const empty=document.createElement('p');empty.className='empty-state';
  empty.textContent='この時間帯に該当する駅はありません。';list.append(empty);
 }
 list.scrollTop=0;list.scrollLeft=0;
 if(typeof updateSheetSummary==='function')updateSheetSummary();
 document.querySelectorAll('[data-minute]').forEach(b=>{
  const active=Number(b.dataset.minute)===selectedMinute;
  b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);
 });
}
let rentPanelActive=false;
function showDestination(id, keepRentPanel=false){
 if(!keepRentPanel)rentPanelActive=false;
 clearTimeout(tapTimer);tapTimer=null;selected=id;profileStation=id;updateSumuLink();document.querySelectorAll('[data-station]').forEach(b=>b.classList.toggle('active',Number(b.dataset.station)===id));$('destinationCard').hidden=false;$('routeOrigin').textContent=STATIONS[origin].name+'から · 発車後の概算';$('destName').textContent=STATIONS[id].name;updateDestRent(id);const minutes=result.best[id].time;$('destTime').textContent=Number.isFinite(minutes)?Math.round(minutes):'—';
 if(typeof updateBulletComparison==='function')updateBulletComparison(id);const steps=result.route(id),stats=result.summary(id);$('destSummary').textContent='乗車 '+Math.round(stats.ride)+'分 / 乗換待ち '+Math.round(stats.boardingWait)+'分 / 乗換移動 '+Math.round(stats.transferWalk)+'分'+(stats.walk?' / 徒歩 '+Math.round(stats.walk)+'分':'');
 const routeBody=$('routeStepsBody');routeBody.replaceChildren();const groups=[];for(const step of steps){const last=groups.at(-1);if(last&&last.type===step.type&&last.line===step.line&&!step.boarding){last.to=step.to;last.t+=step.t;}else groups.push({...step});}
 if(!groups.length){const p=document.createElement('p');p.className='step';p.textContent=id===origin?'ここが中心駅です。':'現在の条件では経路がありません。';routeBody.append(p);}
 for(const group of groups){
  if(group.type==='rail'&&group.wait>0){const wait=document.createElement('div');wait.className='route-wait';wait.textContent=STATIONS[group.from].name+'で'+(group.transfer?'乗換':'乗車待ち')+' · '+(group.transferTime?'移動 '+group.transferTime+'分 ＋ ':'')+'待ち '+group.boardWait+'分';routeBody.append(wait);}
  if(group.through){const through=document.createElement('div');through.className='route-through';through.textContent=STATIONS[group.from].name+'から直通・乗換なし';routeBody.append(through);}
  const row=document.createElement('div');row.className='step';
  const line=group.type==='rail'?LINES[group.line]:null;
  row.style.setProperty('--route-color',line?.color??'#768579');
  const stations=document.createElement('strong');
  stations.textContent=STATIONS[group.from].name+' → '+STATIONS[group.to].name;
  const service=document.createElement('span');
  service.textContent=line?.name??'徒歩';
  const time=document.createElement('span');
  time.className='route-leg-time';time.textContent='約'+Math.round(group.t)+'分';
  row.append(stations);row.append(time);row.append(service);routeBody.append(row);
 }
 if(layerMode&&rentPanelActive&&rentTab==='profile'&&rentLayer)updateRentCards();
 if(typeof updateSheetSummary==='function')updateSheetSummary();
 requestDraw();}
function hit(x,y){const ids=zoom<.12?[...majorStations,...(selected===null?[]:[selected])]:null;
 let nearest=null,near=7;for(const i of ids??STATIONS.keys()){const p=lastScreen[stationIndex[i]];if(!p)continue;const d=Math.hypot(p[0]-x,p[1]-y);if(d<near){nearest=i;near=d;}}if(nearest!==null)return nearest;for(let j=drawLabels.length-1;j>=0;j--){const b=drawLabels[j];if(x>=b[0]&&x<=b[0]+b[2]&&y>=b[1]&&y<=b[1]+b[3])return b.id;}let id=null,best=15;for(const i of ids??STATIONS.keys()){const p=lastScreen[stationIndex[i]];if(!p)continue;const d=Math.hypot(p[0]-x,p[1]-y);if(d<best){id=i;best=d;}}return id;}
function hitRing(x,y,labelsOnly=false){if(mix<.98)return null;for(const ring of ringTargets){const r=ring.rect;if(r&&x>=r[0]-5&&x<=r[0]+r[2]+5&&y>=r[1]-5&&y<=r[1]+r[3]+5)return ring.minute;}if(labelsOnly)return null;let minute=null,best=10;for(const ring of ringTargets){const d=Math.abs(Math.hypot(x-ring.center[0],(y-ring.center[1])/(ring.yScale||1))-ring.radius);if(d<best){best=d;minute=ring.minute;}}return minute;}
const pointers=new Map();let drag=null,pinch=null,lastTap=null,tapTimer=null;
function dismissDestination(){clearTimeout(tapTimer);tapTimer=null;lastTap=null;selected=null;hover=null;$('tip').hidden=true;$('destinationCard').hidden=true;document.querySelectorAll('[data-station]').forEach(b=>b.classList.toggle('active',false));updateSumuLink();if(typeof updateSheetSummary==='function')updateSheetSummary();requestDraw();}
document.addEventListener('pointerdown',e=>{if(!$('railView').hidden&&e.target!==canvas&&!$('destinationCard').contains(e.target)&&!$('regionTools').contains(e.target)&&!e.target.closest?.('dialog, [data-atlas-picker]')&&!$('mapOptions').contains(e.target)&&!$('mapNavigation').contains(e.target)&&!$('rentDock').contains(e.target))dismissDestination();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mapOptions').open&&!$('atlasPicker').open&&!$('railView').hidden){dismissDestination();}});
function stationTap(id,x,y,now=performance.now()){if(lastTap&&lastTap.id===id&&now-lastTap.time<380&&Math.hypot(x-lastTap.x,y-lastTap.y)<24){clearTimeout(tapTimer);tapTimer=null;lastTap=null;selectOrigin(id);return 'center';}if(tapTimer)clearTimeout(tapTimer);lastTap={id,x,y,time:now};tapTimer=setTimeout(()=>{tapTimer=null;showDestination(id);},380);return 'destination';}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{wheelZoom=null;settleMotion();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);$('tip').hidden=true;if(selected!==null)dismissDestination();
 if(pointers.size===1&&e.pointerType!=='touch'&&(e.button===2||e.ctrlKey)){e.preventDefault();clearTimeout(tapTimer);tapTimer=null;lastTap=null;orbit={x:e.clientX,y:e.clientY,yaw,pitch};drag=null;set3D(true);return;}
 if(pointers.size===1){drag={x:e.clientX,y:e.clientY,pan:currentPan(),moved:false};if(e.pointerType==='touch'&&terrainDepth)orbit={x:e.clientX,y:e.clientY,yaw,pitch};}
 else{orbit=null;clearTimeout(tapTimer);tapTimer=null;lastTap=null;const p=[...pointers.values()],r=canvas.getBoundingClientRect();pinch={distance:Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]),zoom,cx:(p[0][0]+p[1][0])/2-r.left,cy:(p[0][1]+p[1][1])/2-r.top,pan:currentPan()};if(drag)drag.moved=true;}});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(pointers.has(e.pointerId)){pointers.set(e.pointerId,[e.clientX,e.clientY]);
 if(pointers.size>1&&pinch){const p=[...pointers.values()],cx=(p[0][0]+p[1][0])/2-r.left,cy=(p[0][1]+p[1][1])/2-r.top,b=baseScreen();b[1]+=viewDepth()*35;zoom=Math.max(.007,Math.min(4,pinch.zoom*Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1])/Math.max(1,pinch.distance)));const scale=zoom/pinch.zoom;pan=[cx-b[0]-(pinch.cx-b[0]-pinch.pan[0])*scale,cy-b[1]-(pinch.cy-b[1]-pinch.pan[1])*scale];if(animation)animation.panFrom=[...pan];requestDraw();return;}
 if(orbit){yaw=orbit.yaw+(e.clientX-orbit.x)*.008;pitch=Math.max(.12,Math.min(1.25,orbit.pitch+(e.clientY-orbit.y)*.006));if(Math.hypot(e.clientX-orbit.x,e.clientY-orbit.y)>5){clearTimeout(tapTimer);tapTimer=null;lastTap=null;if(drag)drag.moved=true;}requestDraw();return;}
 if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5){drag.moved=true;clearTimeout(tapTimer);tapTimer=null;lastTap=null;}pan=[drag.pan[0]+dx,drag.pan[1]+dy];if(animation)animation.panFrom=[...pan];requestDraw();}return;}
 const labelMinute=hitRing(x,y,true),id=labelMinute===null?hit(x,y):null;const minute=id===null?hitRing(x,y):null;if(id!==hover||minute!==hoverMinute){hover=id;hoverMinute=minute;requestDraw();}canvas.style.cursor=id!==null||hoverMinute!==null?'pointer':'grab';if(id===null){$('tip').hidden=true;return;}$('tip').hidden=false;$('tip').innerHTML=STATIONS[id].name+'<small>'+STATIONS[origin].name+'から約'+Math.round(result.best[id].time)+'分 / 概算</small>'+rentTooltip(id);$('tip').style.left=Math.min(x+13,W-175)+'px';$('tip').style.top=Math.min(y+13,H-56)+'px';});
function endPointer(e){if(!pointers.has(e.pointerId))return;if(orbit){pointers.delete(e.pointerId);orbit=null;drag=null;pinch=null;requestDraw();return;}const wasMulti=!!pinch;pointers.delete(e.pointerId);if(!pointers.size){if(drag&&!drag.moved&&!wasMulti&&e.type!=='pointercancel'&&e.type!=='lostpointercapture'){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,label=hitRing(x,y,true),id=label===null?hit(x,y):null;if(label!==null){clearTimeout(tapTimer);lastTap=null;chooseMinute(label);}else if(id!==null)stationTap(id,x,y);else{const minute=hitRing(x,y);if(minute!==null){clearTimeout(tapTimer);lastTap=null;chooseMinute(minute);}}}drag=null;pinch=null;}else{const p=[...pointers.values()][0];drag={x:p[0],y:p[1],pan:[...pan],moved:true};}requestDraw();}
canvas.addEventListener('dblclick',e=>e.preventDefault());canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);canvas.addEventListener('pointerleave',()=>{$('tip').hidden=true;hover=null;hoverMinute=null;requestDraw();});
let wheelZoom=null;
function zoomAround(x,y,next){
 const b=baseScreen(),z=zoom;
 b[1]+=viewDepth()*35;
 zoom=Math.max(.007,Math.min(4,next));
 pan=[x-b[0]-(x-b[0]-pan[0])*zoom/z,y-b[1]-(y-b[1]-pan[1])*zoom/z];
 if(animation)animation.panFrom=[...pan];
}

function advanceWheelZoom(now){
 if(!wheelZoom)return;
 const {x,y,target,last}=wheelZoom;
 const remaining=Math.log(target/zoom);
 const done=Math.abs(remaining)<.002;
 const next=done?target:zoom*Math.exp(remaining*(1-Math.exp(-Math.max(0,now-last)/48)));
 zoomAround(x,y,next);
 if(done)wheelZoom=null;
 else{wheelZoom.last=now;requestDraw();}
}

canvas.addEventListener('wheel',e=>{
 e.preventDefault();
 if(!e.deltaY)return;
 if(!wheelZoom){dismissDestination();settleMotion();}
 const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?H:1);
 const target=Math.max(.007,Math.min(4,(wheelZoom?.target??zoom)*Math.exp(-delta*.0015)));
 if(reduced)zoomAround(x,y,target);
 else wheelZoom={x,y,target,last:wheelZoom?.last??performance.now()};
 requestDraw();
},{passive:false});
$('zoomIn').onclick=()=>{wheelZoom=null;settleMotion();zoomAround(W/2,H/2,zoom*1.25);requestDraw();};
$('zoomOut').onclick=()=>{wheelZoom=null;settleMotion();zoomAround(W/2,H/2,zoom/1.25);requestDraw();};
$('reset').onclick=()=>{wheelZoom=null;yaw=0;pitch=.72;set3D(false);updateModel(true,true);};$('view3d').onclick=()=>set3D(!terrainDepth);$('geoBtn').onclick=()=>changeMix(0,true);$('timeBtn').onclick=()=>changeMix(1,true);$('warpSlider').oninput=e=>changeMix(Number(e.target.value)/100);
$('centerStation').onclick=()=>{if(selected!==null)selectOrigin(selected);};$('stationCount').textContent=STATIONS.length;$('express').onchange=e=>{express=e.target.checked;updateModel();};$('closeCard').onclick=dismissDestination;
for(let minute=10;minute<=90;minute+=10){const b=document.createElement('button');b.dataset.minute=minute;b.innerHTML=minute+'<small>分</small>';b.setAttribute('aria-pressed',minute===selectedMinute);b.classList.toggle('active',minute===selectedMinute);b.onclick=()=>chooseMinute(minute);$('timeChoices').append(b);}
$('aboutBtn').onclick=()=>$('about').showModal();$('closeAbout').onclick=()=>$('about').close();$('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}});

function rentTooltip(id){if(!layerMode||!rentLayer)return '';const r=rentLayer.observed[id];return '<small>'+ (r?'単身相場 '+(r.rent/10000).toFixed(2)+'万円 / 月':'家賃相場なし')+'</small>';}
function updateDestRent(id){
 const el=$('destRent');el.hidden=!layerMode;el.textContent='';
 if(!layerMode||!rentLayer)return;
 const record=rentLayer.observed[id];
 if(!record){el.textContent='家賃相場なし';return;}
 const amount=document.createElement('span');
 amount.textContent='単身家賃 '+(record.rent/10000).toFixed(2)+'万円／月';
 const source=document.createElement('a');
 source.href=rentLayer.source(record).url;
 source.target='_blank';source.rel='noopener';source.textContent='出典 ↗';
 el.append(amount);el.append(source);
}
async function loadRent(){if(rentPromise)return rentPromise;rentPromise=(async()=>{
 const data=await fetch('rent-data.json?v=9').then(r=>{if(!r.ok)throw Error('data');return r.json();});
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='rent-layer.js?v=11';script.onload=resolve;script.onerror=reject;document.head.append(script);});
 rentLayer=globalThis.createRentLayer(data,STATIONS,LINES,xy);
 $('rentStatus').textContent=rentLayer.count+'駅 · 補間・徒歩補正は推定';
 $('rentSources').replaceChildren();for(const source of data.sources){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent="LIFULL HOME'S / "+source.name+' ↗';$('rentSources').append(a);$('rentSources').append(document.createElement('br'));}
 return rentLayer;
 })().catch(e=>{rentPromise=null;throw e;});return rentPromise;}
// Keep every entry point in sync, including pending and failed lazy loads.
function syncRentEntry(enabled,pending=false){
 for(const [id,active]of [['rentExplore',enabled],['timeExplore',!enabled]]){
  $(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',active);
 }
 $('rentExplore').setAttribute('aria-busy',pending);
 $('rentLoading').hidden=!pending;
 $('dockModeHint').textContent=pending?'家賃相場を読み込み中…':enabled?'安い順':'';
}
async function setLayer(enabled){
 const ticket=++layerRequest,changed=!!enabled!==!!layerMode;
 syncRentEntry(!!enabled,!!enabled&&!rentLayer);
 if(enabled){$('announce').textContent='家賃データを読み込んでいます。';try{await loadRent();}catch(e){
  if(ticket!==layerRequest)return;syncRentEntry(!!layerMode);
  $('dockModeHint').textContent='家賃を読み込めませんでした。もう一度お試しください。';$('announce').textContent=$('dockModeHint').textContent;return;
 }}
 if(ticket!==layerRequest)return;
 layerMode=enabled?1:0;syncRentEntry(!!enabled);
 $('rentLegend').hidden=!enabled;$('rentTabs').hidden=!enabled;$('rentFilters').hidden=!enabled;$('rentFoot').hidden=!enabled;
 $('rentDock').classList.toggle('with-rent',!!enabled);
 // A switch always starts with the station prices, even after a profile view.
 if(changed&&enabled){rentTab='stations';syncRentTabs();}
 if(changed)rentPanelActive=!!enabled;
 if(selected!==null)updateDestRent(selected);updateCards();requestDraw();
 $('announce').textContent=enabled?'家賃表示に切り替えました。下部のシートで時間帯を指定できます。':'時間表示に戻しました。';
}
let rentFrom=20,rentTo=40;
let rentHourlyEnabled=false,rentHourlyValue=2000,rentCommuteDays=20;

function syncRentRange(){
 $('rentFrom').value=rentFrom;
 $('rentTo').value=rentTo;
}

function commuteRent(rent,time){
 return rent!==null&&Number.isFinite(time)
  ? rent+Math.round(time*2*rentCommuteDays*rentHourlyValue/60) : null;
}

function updateRentCards(keepChartPosition=false){
 const profile=rentTab==='profile',list=$('placeCards');
 const previousScroll=list.scrollLeft;
 $('placesTitle').textContent='家賃';
 $('suggestionMeta').textContent=profile?'沿線断面':'片道 '+rentFrom+'〜'+rentTo+'分'+(rentHourlyEnabled?' · 時給込み':'');
 $('dockModeHint').textContent='';
 $('profileCaption').hidden=true;
 $('profileLines').hidden=true;
 $('profileLegend').hidden=!(profile&&rentHourlyEnabled);
 $('rentRange').hidden=profile;
 $('timeChoices').hidden=true;
 list.classList.toggle('profile-cards',profile);
 list.replaceChildren();
 if(profile){
  renderStationProfile();
  if(keepChartPosition)list.scrollLeft=previousScroll;
 } else {
  const matches=STATIONS.flatMap(station=>{
   const rent=rentLayer.observed[station.id]?.rent;
   const time=result.best[station.id].time;
   if(!rent||time<rentFrom||time>rentTo)return [];
   return [{station,rent,time,total:rentHourlyEnabled?commuteRent(rent,time):rent}];
  }).sort((a,b)=>a.total-b.total||a.time-b.time);
  for(const {station,rent,time,total} of matches){
   const button=document.createElement('button');
   button.className='place rent-place';button.dataset.station=station.id;
   const name=document.createElement('h3');name.textContent=station.name;
   const price=document.createElement('div');price.className='mins';
   price.textContent=(total/10000).toFixed(2)+'万円';
   const detail=document.createElement('span');detail.className='comparison';
   detail.textContent='約'+Math.round(time)+'分 · '+(rentHourlyEnabled?'家賃 '+(rent/10000).toFixed(2)+'万円':routeChangeLabel(station.id));
   button.append(name);button.append(price);button.append(detail);
   button.onclick=()=>showDestination(station.id);list.append(button);
  }
 }
 if(!list.children.length){
  const empty=document.createElement('p');empty.className='empty-state';
  empty.textContent='この時間帯の家賃相場は未収録です。';list.append(empty);
 }
 if(typeof updateSheetSummary==='function')updateSheetSummary();
 $('rentFoot').textContent=rentHourlyEnabled?'時給込み＝家賃＋片道時間 × 往復 × 出社日数 × 時給':'単身向け · 面積・築年数未補正';
}
function renderStationProfile(){
 const station=profileStation??origin;
 const lines=rentLayer.profileLines(station);
 const choices=$('profileLines');
 choices.replaceChildren();
 choices.hidden=lines.length<2;

 $('dockModeHint').textContent='';
 if(!lines.length){
  profileLine=null;
  const message=document.createElement('p');
  message.className='empty-state';
  message.textContent='この駅の沿線家賃は未収録です。家賃データがある東京圏の駅を選んでください。';
  $('placeCards').append(message);
  return;
 }
 if(!lines.some(line=>line.name===profileLine))profileLine=lines[0].name;
 if(lines.length>1)for(const line of lines){
  const chip=document.createElement('button');
  chip.type='button';
  chip.textContent=line.name;
  chip.style.setProperty('--line-color',line.color);
  chip.setAttribute('aria-pressed',line.name===profileLine);
  chip.onclick=()=>{profileLine=line.name;updateRentCards();choices.querySelector('[aria-pressed="true"]')?.focus();};
  choices.append(chip);
 }
 drawProfile(station);
}
function drawProfile(station){
 const rows=rentLayer.profile(profileLine).map(row=>({...row,total:commuteRent(row.rent,result.best[row.id].time)}));
 const width=Math.max(540,rows.length*54),height=234,top=24,bottom=178;
 const largest=Math.max(60000,...rows.map(row=>(rentHourlyEnabled?row.total??row.rent:row.rent)??0));
 const step=Math.ceil(largest/4/10000)*10000;
 const y=value=>bottom-value/(4*step)*(bottom-top);
 const x=index=>53+index*(width-82)/Math.max(1,rows.length-1);
 function node(name,attrs,label){
  const el=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
  if(label!==undefined)el.textContent=label;
  return el;
 }
 const svg=node('svg',{viewBox:'0 0 '+width+' '+height,width,height,role:'img','aria-label':profileLine+'の沿線家賃'+(rentHourlyEnabled?'と時給込みの月額':'')});
 for(let i=0;i<=4;i++){
  const py=y(i*step);
  svg.append(node('line',{x1:43,y1:py,x2:width,y2:py,stroke:'#d1d8ca','stroke-dasharray':'2 4'}));
  svg.append(node('text',{x:0,y:py+4,fill:'#526462','font-size':10},i*step/10000+'万'));
 }
 const series=rentHourlyEnabled?[['rent','#668775'],['total','#aa6337']]:[['rent','#31756a']];
 for(const [key,color] of series){
  let segment=[];
  const flush=()=>{
   if(segment.length>1)svg.append(node('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':2}));
   segment=[];
  };
  rows.forEach((row,i)=>{if(row[key]===null)flush();else segment.push(x(i)+','+y(row[key]));});flush();
 }
 rows.forEach((row,i)=>{
  const label=row.name+' · '+(row.rent===null?'相場なし':'家賃 '+(row.rent/10000).toFixed(2)+'万円')+
   (rentHourlyEnabled&&row.total!==null?' · 時給込み '+(row.total/10000).toFixed(2)+'万円':'');
  const g=node('g',{'data-profile-station':row.id,role:'button',tabindex:0,'aria-label':label});
  g.append(node('title',{},label));
  g.append(node('rect',{x:x(i)-22,y:0,width:44,height,fill:'transparent'}));
  for(const [key,color] of series){
   const value=row[key];if(value===null)continue;
   g.append(node('circle',{cx:x(i),cy:y(value),r:row.id===station?5:3.5,fill:color,stroke:'#fff','stroke-width':1}));
   if(row.id===station||rows.length<16||i%2===0)g.append(node('text',{x:x(i),y:y(value)-(key==='total'?9:7),'text-anchor':'middle',fill:color,'font-size':9},(value/10000).toFixed(1)));
  }
  g.append(node('text',{x:x(i),y:196,fill:row.id===station?'#223637':'#526462','font-weight':row.id===station?700:400,'font-size':11,transform:'rotate(34 '+x(i)+' 196)'},row.name));
  const pick=()=>showDestination(row.id,true);
  g.addEventListener('click',pick);
  g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pick();}});
  svg.append(g);
 });
 const list=$('placeCards');
 list.append(svg);
 const index=rows.findIndex(row=>row.id===station);
 if(index>=0)list.scrollLeft=Math.max(0,x(index)-list.clientWidth/2);
 const caption=$('profileCaption');caption.hidden=false;
 const chosen=rows[index];
 caption.textContent=profileLine+' · '+STATIONS[station].name+
  (rentHourlyEnabled&&chosen?.total!=null?'　時給込み '+(chosen.total/10000).toFixed(2)+'万円':'');
}
for(const id of ['rentFrom','rentTo']){
 const input=$(id);
 for(let minutes=0;minutes<=90;minutes+=10){
  const option=document.createElement('option');option.value=minutes;option.textContent=minutes+'分';input.append(option);
 }
 input.onchange=()=>{
  if(id==='rentFrom'){rentFrom=Number(input.value);rentTo=Math.max(rentFrom,rentTo);}
  else{rentTo=Number(input.value);rentFrom=Math.min(rentFrom,rentTo);}
  syncRentRange();updateRentCards();requestDraw();
 };
}
syncRentRange();
$('rentHourly').onchange=()=>{
 rentHourlyEnabled=$('rentHourly').checked;
 $('rentHourlyFields').hidden=!rentHourlyEnabled;
 updateRentCards(true);
};
for(const id of ['rentHourlyValue','rentCommuteDays'])$(id).oninput=()=>{
 const input=$(id);
 if(!input.validity.valid||!Number.isFinite(input.valueAsNumber))return;
 if(id==='rentHourlyValue')rentHourlyValue=input.valueAsNumber;
 else rentCommuteDays=input.valueAsNumber;
 updateRentCards(true);
};
function syncRentTabs(){for(const [id,value]of [['rentStations','stations'],['rentProfile','profile']]){const active=rentTab===value;$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',active);}}
$('rentExplore').onclick=()=>setLayer(true);$('timeExplore').onclick=()=>setLayer(false);
for(const [id,value]of [['rentStations','stations'],['rentProfile','profile']])$(id).onclick=()=>{rentPanelActive=true;rentTab=value;syncRentTabs();updateCards();};
$('stationProfile').onclick=async()=>{
 const station=selected;
 if(station===null)return;
 await setLayer(true);
 if(!layerMode||selected!==station)return;
 rentPanelActive=true;
 rentTab='profile';
 syncRentTabs();
 updateRentCards();
};
$('rentInfo').onclick=()=>{$('about').showModal();$('rentMethod').scrollIntoView({block:'start'});};
window.addEventListener('resize',resize);if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(canvas);resize();mix=0;updateModel(false);changeMix(1,true);

function updateSumuLink(workplace=origin){const base='https://sumu-eki.yudai-grex4.chatgpt.site/',params=new URLSearchParams(location.search);let target;
 try{const url=new URL(params.get('return'));if(url.origin===new URL(base).origin&&url.pathname==='/')target=url;}catch{}
 if(target&&selected!==null&&target.hash.startsWith('#v1=')){try{const data=JSON.parse(decodeURIComponent(target.hash.slice(4)));data.pins=[...(Array.isArray(data.pins)?data.pins.filter(n=>n!==STATIONS[selected].name):[]),STATIONS[selected].name].slice(-3);target.hash='v1='+encodeURIComponent(JSON.stringify(data));}catch{}}
 if(!target){target=new URL(base);const other=workplace===S['大手町']?S['新宿']:S['大手町'];const data={v:1,config:{people:[{station:STATIONS[workplace].name,days:5,limit:45,officeWalk:5},{station:STATIONS[other].name,days:5,limit:45,officeWalk:5}],layout:'1LDK',budget:250000,useBudget:false,homeWalk:10,maxTransfers:2,express:true,costWeight:.35,fairness:.55},pins:selected!==null?[STATIONS[selected].name]:[]};target.hash='v1='+encodeURIComponent(JSON.stringify(data));}
 $('sumuLink').href=target.href;$('sumuLink').textContent=params.has('return')?'住む駅の比較に戻る ↗':'複数の勤務地で比較 ↗';
}
const crossQuery=new URLSearchParams(location.search);if(Number.isInteger(S[crossQuery.get('origin')])){origin=S[crossQuery.get('origin')];mix=1;updateModel(false);animation=null;}if(Number.isInteger(S[crossQuery.get('station')]))showDestination(S[crossQuery.get('station')]);updateSumuLink();
