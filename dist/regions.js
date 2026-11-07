/* Regional data is kept separate from the shared routing graph. */
const STATION_COUNT_TOKYO = STATIONS.length;
const SERVICES = [];
const regionalConnections = [];
const stationNames = new Map();
const sourceMappedTokyo = new Set();
const stationKey = name => name.replace(/[ヶヵ]/g,'ケ');
const HIGHLIGHTS = new Set('吉祥寺 新宿 渋谷 池袋 東京 品川 新横浜 横浜 小田原 熱海 静岡 浜松 豊橋 名古屋 岐阜 米原 京都 大津 新大阪 大阪 梅田 大阪梅田 なんば 天王寺 京橋 高槻 神戸 三ノ宮 神戸三宮 姫路 奈良 関西空港 稚内 旭川 札幌 函館 新函館北斗 青森 新青森 秋田 盛岡 仙台 福島 山形 新潟 長野 富山 金沢 福井 敦賀 松本 高山 鳥取 松江 岡山 広島 山口 新山口 下関 小倉 博多 熊本 大分 宮崎 長崎 佐賀 鹿児島中央 高松 松山 徳島 高知 那覇空港 県庁前'.split(' '));

function findStation(name, region) {
  return STATIONS.find(s => s.name === name && (!region || s.region === region))?.id;
}

function registerStation(name, lon, lat, region, sourceStation=false) {
  const key = stationKey(name), matches=stationNames.get(key)??[];
  const nearby = matches.filter(s => !sourceStation||(s.id<STATION_COUNT_TOKYO&&!sourceMappedTokyo.has(s.id)));
  const existing = nearby.find(s => distance(s, {lon,lat}) < .45);
  if (existing) {
    if(sourceStation)sourceMappedTokyo.add(existing.id);
    return existing.id;
  }
  const id = STATIONS.length;
  const station={id, name, lon, lat, region};
  STATIONS.push(station);
  matches.push(station);
  stationNames.set(key,matches);
  if (S[name] === undefined) S[name] = id;
  return id;
}

function distance(a,b) {
  const east = (a.lon-b.lon)*111.195*Math.cos((a.lat+b.lat)*Math.PI/360);
  return Math.hypot(east, (a.lat-b.lat)*111.195);
}

function service(name, color, {mode='rail', wait=5, dwell=.45} = {}) {
  const id = SERVICES.length;
  SERVICES.push({id, name, color, mode, wait, dwell, edges:[]});
  return id;
}

function link(from, to, id, dir, run, dwell) {
  if (from !== to) SERVICES[id].edges.push({from, to, dir, run, dwell});
}

function chain(id, stops, times) {
  if (times.length !== stops.length-1 || stops.some(s => !Number.isInteger(s))) {
    throw new Error('Invalid stops for '+SERVICES[id].name);
  }
  for (let i=1; i<stops.length; i++) {
    link(stops[i-1], stops[i], id, 0, times[i-1]);
    link(stops[i], stops[i-1], id, 1, times[i-1]);
  }
}

for (const s of STATIONS) {
  s.region='東京圏';
  const key=stationKey(s.name);
  if(!stationNames.has(key))stationNames.set(key,[]);
  stationNames.get(key).push(s);
}
const geoIds = {};
for (const [code,[name,lon,lat,region]] of Object.entries(RAIL_GEODATA.stations)) {
  geoIds[code]=registerStation(name,lon,lat,region,true);
}
const eastCorridor = '横浜 戸塚 大船 藤沢 辻堂 茅ケ崎 平塚 大磯 二宮 国府津 鴨宮 小田原 早川 根府川 真鶴 湯河原 熱海'.split(' ');
const eastStops=eastCorridor.map(name => {
  const point=RAIL_GEODATA.east[name]??RAIL_GEODATA.east[name.replace('ケ','ヶ')];
  return point ? registerStation(name,...point,'東海道') : findStation(name);
});
const eastId=service('JR東海道線（横浜〜熱海）','#dd9b3d',{wait:7});
chain(eastId,eastStops,[9,5,4,3,4,5,4,5,5,3,3,3,5,5,4,5]);
regionalConnections.push(['横浜','東海道線',0,SERVICES[eastId].name,0]);

const operatorColors={
  '北海道旅客鉄道':'#829e73','東日本旅客鉄道':'#81a48a','四国旅客鉄道':'#76a6a3','九州旅客鉄道':'#ad7774',
  '西日本旅客鉄道':'#5b9bdd','東海旅客鉄道':'#df9745','阪急電鉄':'#ba777c',
  '阪神電気鉄道':'#62adba','京阪電気鉄道':'#57af91','近畿日本鉄道':'#d9956a',
  '南海電気鉄道':'#7a91d4','京都市':'#77b99a','神戸市':'#7faea0',
};
const operatorShort={
  '北海道旅客鉄道':'JR北海道','東日本旅客鉄道':'JR東日本','四国旅客鉄道':'JR四国','九州旅客鉄道':'JR九州',
  '西日本旅客鉄道':'JR西日本','東海旅客鉄道':'JR東海','大阪市高速電気軌道':'Osaka Metro',
  '阪急電鉄':'阪急','阪神電気鉄道':'阪神','京阪電気鉄道':'京阪','近畿日本鉄道':'近鉄',
  '南海電気鉄道':'南海','京都市':'京都市営地下鉄','神戸市':'神戸市営地下鉄',
};
const metroColors=['#ea747f','#b887d1','#6295d8','#85bd82','#d582aa','#baac67','#a5b56c','#e59b65'];

function addGeoLinks(id, edges, speed, overhead) {
  for (const [a,b,km] of edges) {
    const from=geoIds[a], to=geoIds[b];
    const run=Math.max(.55,km/speed+overhead);
    // Direction is reserved for explicitly ordered services. These graph-derived
    // segments are direction-neutral until actual service patterns are added.
    link(from,to,id,0,run);
    link(to,from,id,0,run);
  }
}

const modeledTokyoPairs = new Set();
const stationPair=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
for(const l of LINES.filter(l=>!l.express))for(let i=1;i<l.stops.length;i++)modeledTokyoPairs.add(stationPair(l.stops[i-1],l.stops[i]));
for (const [operator,line,edges,kind] of RAIL_GEODATA.lines) {
  if(line==='東海道新幹線')continue; // The original pilot supplies its three service patterns.
  const bullet=line.endsWith('新幹線');
  // Keep the source alignment without inventing a passenger train across the Seikan Tunnel.
  if(line==='海峡線')continue;
  const jr=operator.includes('旅客鉄道');
  const metro=operator==='大阪市高速電気軌道';
  const subway=kind==='21';
  const slow=kind==='16'||kind==='24'||kind==='15';
  const color=metro ? metroColors[parseInt(line,10)-1]??'#6ca9b1' : operatorColors[operator]??'#90a590';
  const name=(operatorShort[operator]??operator)+' '+line.replace(/^\d+号線\((.+)\)$/,'$1');
  if (operator==='東海旅客鉄道' && line==='東海道線') {
    const cuts=['沼津','静岡','浜松','豊橋','大垣'].map(name=>STATIONS[findStation(name)].lon);
    const stations=['大垣','豊橋','浜松','静岡','沼津','熱海'];
    const partitions=Array.from({length:6},()=>[]);
    for (const edge of edges) {
      const lon=(STATIONS[geoIds[edge[0]]].lon+STATIONS[geoIds[edge[1]]].lon)/2;
      partitions[cuts.filter(c=>lon>c).length].push(edge);
    }
    partitions.forEach((part,i)=>addGeoLinks(service(name+'（'+stations[i]+'方面）',color,{wait:[21,9,12,12,10,14][i]}),part,1.2,.38));
  } else {
    const eastMain = operator==='東日本旅客鉄道' && line==='東海道線';
    const westMain = operator==='西日本旅客鉄道' && line==='東海道線';
    const eastPairs = eastMain ? new Set(eastStops.slice(1).map((id,i)=>stationPair(id,eastStops[i]))) : null;
    const links=edges.filter(([a,b])=>{
      const from=geoIds[a],to=geoIds[b], pair=stationPair(from,to);
      if(!bullet&&modeledTokyoPairs.has(pair))return false;
      if(eastPairs?.has(pair))return false;
      return !westMain||![a,b].some(s=>RAIL_GEODATA.stations[s][0]==='福島');
    });
    addGeoLinks(service(name,bullet?'#cf8b55':color,{
      mode:bullet?'shinkansen':'rail',
      wait:bullet?24:subway?4:slow?12:jr?12:8,
      dwell:bullet?1.2:.45
    }),links,bullet?3.7:subway?.69:slow?.36:jr?1:.83,bullet?1.3:subway?.32:.48);
  }
}

function regionalChain(name,color,names,times,options={}) {
  const ids=names.split(' ').map(name=>
    (options.mode==='shinkansen'?geoIds[RAIL_GEODATA.bullet_stops[name]]:undefined)
    ??findStation(name,options.region)??findStation(name));

  const id=service(name,color,options);
  chain(id,ids,times);
  return id;
}
regionalChain('JR西日本 新快速','#70c5f3','米原 彦根 能登川 近江八幡 野洲 守山 草津 南草津 石山 大津 山科 京都 高槻 新大阪 大阪 尼崎 芦屋 三ノ宮 神戸 明石 西明石 加古川 姫路',[5,8,6,6,3,4,4,5,4,5,5,12,11,4,6,8,8,4,13,4,10,11],{region:'京阪神',wait:8,dwell:.55});
regionalChain('阪急 京都線 特急','#e08e95','大阪梅田 十三 淡路 茨木市 高槻市 長岡天神 桂 烏丸 京都河原町',[4,4,8,5,8,6,7,2],{region:'京阪神',wait:6});
regionalChain('阪急 神戸線 特急','#d47b87','大阪梅田 十三 塚口 西宮北口 夙川 岡本 神戸三宮',[4,6,5,3,4,7],{region:'京阪神',wait:6});

regionalChain('JR東海 新快速','#f5b86e','豊橋 蒲郡 岡崎 安城 刈谷 大府 金山 名古屋 尾張一宮 岐阜 西岐阜 穂積 大垣',[10,11,6,6,5,12,4,10,9,3,3,6],{region:'東海道',wait:12});
const shinkansenColors='#f4b562';
const shinkansenNames='東京 品川 新横浜 小田原 熱海 三島 新富士 静岡 掛川 浜松 豊橋 三河安城 名古屋 岐阜羽島 米原 京都 新大阪'.split(' ');
for (const name of shinkansenNames) {
  const point=RAIL_GEODATA.shinkansen[name];
  registerStation(name,...point,'東海道');
}
regionalChain('東海道新幹線 のぞみ',shinkansenColors,'東京 品川 新横浜 名古屋 京都 新大阪',[6,10,77,33,13],{mode:'shinkansen',wait:7,dwell:.9});
regionalChain('東海道新幹線 ひかり',shinkansenColors,'東京 品川 新横浜 静岡 浜松 豊橋 名古屋 岐阜羽島 米原 京都 新大阪',[6,10,39,21,13,20,11,16,18,13],{mode:'shinkansen',wait:18,dwell:1});
regionalChain('東海道新幹線 こだま',shinkansenColors,shinkansenNames.join(' '),[6,10,15,8,7,10,9,13,11,13,14,9,11,14,18,13],{mode:'shinkansen',wait:22,dwell:1.8});

// Intercity patterns across infrastructure/operator boundaries.
regionalChain('東北・北海道新幹線 はやぶさ','#cf8b55','東京 上野 大宮 仙台 盛岡 八戸 新青森 新函館北斗',[5,19,66,38,27,24,56],{mode:'shinkansen',wait:22,dwell:1});
regionalChain('山陽新幹線 のぞみ','#cf8b55','新大阪 新神戸 岡山 広島 小倉 博多',[12,31,35,47,15],{mode:'shinkansen',wait:14,dwell:1});
regionalChain('山陽・九州新幹線 みずほ','#cf8b55','新大阪 新神戸 岡山 広島 小倉 博多 熊本 鹿児島中央',[12,31,35,47,15,32,43],{mode:'shinkansen',wait:32,dwell:1});
regionalChain('北陸新幹線 かがやき','#cf8b55','東京 上野 大宮 長野 富山 金沢 福井 敦賀',[5,19,52,44,19,24,17],{mode:'shinkansen',wait:23,dwell:1});
regionalChain('上越新幹線 とき','#cf8b55','東京 上野 大宮 熊谷 本庄早稲田 高崎 上毛高原 越後湯沢 浦佐 長岡 燕三条 新潟',[5,19,12,10,8,15,12,11,10,10,12],{mode:'shinkansen',wait:23,dwell:.9});
regionalChain('秋田新幹線 こまち','#cf8b55','東京 上野 大宮 仙台 盛岡 雫石 田沢湖 角館 大曲 秋田',[5,19,66,38,13,20,12,12,29],{mode:'shinkansen',wait:24,dwell:1});
regionalChain('山形新幹線 つばさ','#cf8b55','東京 上野 大宮 宇都宮 郡山 福島 米沢 高畠 赤湯 かみのやま温泉 山形 天童 さくらんぼ東根 村山 大石田 新庄',[5,19,24,27,13,32,8,5,11,9,9,7,4,9,13],{mode:'shinkansen',wait:25,dwell:1});
regionalChain('JR北海道 特急北斗','#869d74','新函館北斗 森 八雲 長万部 洞爺 伊達紋別 東室蘭 登別 苫小牧 南千歳 新札幌 札幌',[19,20,21,24,11,18,13,22,17,17,9],{region:'北海道',wait:31,dwell:.6});
regionalChain('JR西日本・四国 マリンライナー','#82a49b','岡山 妹尾 早島 茶屋町 植松 木見 上の町 児島 坂出 高松',[7,5,4,4,4,4,4,15,14],{wait:15,dwell:.4});

regionalChain('三岐鉄道 近鉄連絡線','#90a590','近鉄富田 大矢知',[5],{region:'中部',wait:15});
const REGIONAL_LINES_START = LINES.length;
for (const line of SERVICES) {
  const edges = line.edges;
  const stops = [...new Set(edges.flatMap(edge => [edge.from,edge.to]))];
  LINES.push({
    ...line, edges, stops,
    bullet: line.mode === 'shinkansen',
    express: line.mode!=='shinkansen'&&(line.name.includes('新快速')||line.name.includes('特急')||line.name.includes('マリンライナー'))
  });
}
ROUTING_POLICY.through.push(...regionalConnections);

const REGIONAL_WALKS = [];
for (const [names,minutes] of [
  ['大阪 梅田',5],['大阪 大阪梅田',6],['大阪 西梅田',6],['大阪 東梅田',8],['大阪 北新地',10],
  ['大阪梅田 梅田',5],['北新地 西梅田',3],['北新地 東梅田',7],
  ['難波 なんば',5],['大阪難波 なんば',4],['ＪＲ難波 なんば',8],['JR難波 なんば',8],
  ['なんば 日本橋',9],['日本橋 近鉄日本橋',3],['天王寺 大阪阿部野橋',5],
  ['京都河原町 祇園四条',6],['烏丸 四条',4],['三条 三条京阪',4],['京都 七条',15],
  ['三ノ宮 三宮',4],['三ノ宮 神戸三宮',5],['神戸三宮 三宮',5],['神戸 高速神戸',5],['神戸 ハーバーランド',4],
  ['大阪上本町 谷町九丁目',6],['京橋 大阪ビジネスパーク',8],['新今宮 動物園前',5],
  ['近鉄奈良 奈良',15],['西田原本 田原本',4],['新王寺 王寺',4],['ケーブル八瀬 八瀬比叡山口',7],['ケーブル八幡宮口 石清水八幡宮',4],['鳥居前 生駒',5],['明石 山陽明石',4],['姫路 山陽姫路',5],
]) {
  const [a,b]=names.split(' ');
  const from = findStation(a,'京阪神'), to = findStation(b,'京阪神');
  if (Number.isInteger(from) && Number.isInteger(to) && from !== to) REGIONAL_WALKS.push([from,to,minutes]);
}


// Inferred short connections complement the grouped station IDs in N02.
const walkBuckets = new Map();
const bucketSize=.005;
for (const station of STATIONS) {
  const x=Math.floor(station.lon/bucketSize), y=Math.floor(station.lat/bucketSize);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    for(const other of walkBuckets.get((x+dx)+':'+(y+dy))??[]){
      if(station.id<STATION_COUNT_TOKYO&&other.id<STATION_COUNT_TOKYO)continue;
      const km=distance(station,other);
      if(km<=.34&&!REGIONAL_WALKS.some(([a,b])=>a===other.id&&b===station.id||a===station.id&&b===other.id)){
        REGIONAL_WALKS.push([other.id,station.id,3+km*1.25/4.8*60]);
      }
    }
  }
  const key=x+':'+y;
  if(!walkBuckets.has(key))walkBuckets.set(key,[]);
  walkBuckets.get(key).push(station);
}
