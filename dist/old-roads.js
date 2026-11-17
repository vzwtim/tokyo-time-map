'use strict';

const roadQuery = $('roadQuery'), roadSuggestions = $('roadSuggestions');
const setRoadSheetLevel = bindMapSheet($('roadDock'), $('roadSheetHandle'), $('roadSheetBody'), requestDraw);
const roadColors = ['#a75437','#66598c','#397969','#96652d','#297185','#8d674e'];
const transferColor='#8d5533';
let oldRoadData, oldRoadRequest, roadNetwork, roadJourneys, roadStart, roadDestination;
let roadSpeed=4, roadTimeView=false, roadSearchingOrigin=false, roadHour=null, roadRings=[];
let roadTrip=[], roadWarp=null, roadTimeShapes=null, roadTripShape=null;
const cyclingEpisodes=[
  ['R002','日本橋','高崎','LTbuy5TDnkM'],
  ['R002','高崎','岩村田','p7tof_9LEGA'],
  ['R002','塩名田','下諏訪','PohYcbxYwqU'],
  ['R002','下諏訪','福島','oTAyAkobTko'],
  ['R002','福島','馬籠','AV41DNDRaMk'],
  ['R002','馬籠','太田','seXxnPMgR0E'],
  ['R002','太田','鳥居本','FBEtIdYx5T0'],
  ['R002','高宮','三条大橋','vdv1KIftjIU'],
  ['R004','宇都宮','白河','2v_vI3E9cts'],
];
let roadCycling=false;
const cyclingByHub=new Map();
let cyclingSegments=[],cyclingGeoShapes;
setRoadSheetLevel(0);

function roadShape(paths) {
  const shape = new Path2D(), box = [Infinity,Infinity,-Infinity,-Infinity];
  for(const path of paths){
    atlasPath(shape,path);
    for(const [x,y] of path){
      box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);
    }
  }
  return {shape,box};
}

function loadOldRoads() {
  if (oldRoadData || oldRoadRequest) return;
  $('roadLoading').hidden = false;
  oldRoadRequest = fetch('old-roads.json?v=3').then(response => {
    if (!response.ok) throw Error('roads');
    return response.json();
  }).then(entries => {
    oldRoadData = entries.map(([id,name,lines,stops],index)=>{
      const paths=lines.map(line=>line.map(geoXY));
      return {id,name,paths,color:roadColors[index<5?index:5],...roadShape(paths),
        stops:stops.map(([name,,region,lon,lat,hub])=>({name,region,hub,point:geoXY([lon,lat])}))};
    });
    roadNetwork=buildRoadGraph(oldRoadData);
    indexCyclingEpisodes();
    setRoadStart(roadNetwork.stops.find(stop=>stop.name==='日本橋'),false);
    if(document.activeElement===roadQuery&&roadQuery.value.trim())renderRoadSuggestions();
  }).catch(() => {
    oldRoadData=null;
    $('roadStatus').textContent = '街道を読み込めませんでした。地図を切り替えてから開き直してください。';
    setRoadSheetLevel(1);
  }).finally(() => {oldRoadRequest=null;$('roadLoading').hidden=true;});
}

function indexCyclingEpisodes(){
  cyclingByHub.clear();
  cyclingSegments=[];
  cyclingGeoShapes=null;
  for(const [roadId,first,last,video] of cyclingEpisodes){
    const road=oldRoadData.find(entry=>entry.id===roadId);
    const stops=road?.stopsByPath.find(path=>path.some(stop=>stop.name===first)&&path.some(stop=>stop.name===last));
    if(!stops)continue;
    const endpoints=[first,last].map(name=>stops.findIndex(stop=>stop.name===name)).sort((a,b)=>a-b);
    const visited=stops.slice(endpoints[0],endpoints[1]+1);
    for(const stop of visited){
      const episodes=cyclingByHub.get(stop.hub)??[];
      episodes.push({name:road.name+' '+first+' → '+last,video});
      cyclingByHub.set(stop.hub,episodes);
    }
    cyclingSegments.push(visited.slice(1).map((to,i)=>({road,from:visited[i],to})));
  }
}

function cyclingShapes(warp){
  return cyclingSegments.map(edges=>roadShape(edges.map(edge=>roadTripPoints(edge,warp))));
}

function renderCyclingVideos(){
  const list=$('roadVideos');
  const videos=roadCycling&&roadDestination?(cyclingByHub.get(roadDestination.hub)??[]):[];
  list.replaceChildren();
  list.hidden=!videos.length;
  for(const {name,video} of videos){
    const link=document.createElement('a');
    link.href='https://www.youtube.com/watch?v='+video;
    link.target='_blank';
    link.rel='noopener';
    link.textContent='▶ '+name+' ↗';
    list.append(link);
  }
}

function roadMinutes(stop) {return roadJourneys.distances[stop.index]/roadSpeed*60;}
function roadDuration(minutes) {
  if(!Number.isFinite(minutes))return '経路なし';
  const value=Math.round(minutes),hours=Math.floor(value/60);
  return (hours?hours+'時間':'')+(value%60||!hours?(value%60)+'分':'');
}
function roadDistanceLabel(kilometres){return kilometres.toFixed(kilometres<100?1:0)+' km';}

function roadOptionsChanged() {
  roadWarp=null;roadTimeShapes=null;
  updateRoadTrip();
}
function setRoadStart(stop,recenter=true) {
  roadStart=stop;roadDestination=null;roadHour=null;
  roadJourneys=routeOldRoads(roadNetwork,stop);
  $('roadOrigin').textContent=stop.name+' ▾';
  roadOptionsChanged();
  if(recenter)centerAtlasPoint(stop.point);
}
function selectRoadStop(stop,center=false) {
  roadDestination=stop;
  roadHour=null;
  updateRoadTrip();
  if(center)centerAtlasPoint(roadDisplayPoint(stop));
}
function updateRoadTrip() {
  roadTrip=roadDestination?roadJourneys.path(roadDestination):[];
  roadTripShape=null;
  renderRoadSheet();
  requestDraw();
}

function renderRoadSheet() {
  if(!roadStart)return;
  renderCyclingVideos();
  const focus=roadDestination??roadStart;
  const minutes=roadMinutes(focus), connected=Number.isFinite(minutes);
  const members=roadNetwork.groups.get(focus.hub);
  $('roadsTitle').textContent=roadDestination?roadStart.name+' → '+focus.name:roadHour?roadDuration(roadHour*60)+'前後の宿場':roadStart.name+'から';
  $('roadTerminals').textContent=roadDestination?(connected?'約'+roadDuration(minutes):'経路なし'):(roadSpeed===4?'徒歩':'馬')+' · '+oldRoadData.length+'街道';
  $('roadActions').hidden=!roadDestination||roadDestination.hub===roadStart.hub;
  const memberList=$('roadMembers');
  memberList.replaceChildren();
  if(roadDestination){
    for(const label of new Set(members.map(stop=>stop.road.name))){
      const chip=document.createElement('span');chip.textContent=label;memberList.append(chip);
    }
  }
  const steps=$('roadSteps');steps.replaceChildren();
  const rows=[];
  for(const edge of roadTrip){
    if(!edge.road)continue;
    const last=rows.at(-1);
    if(last?.road===edge.road){last.end=edge.to;last.distance+=edge.distance;}
    else rows.push({road:edge.road,start:edge.from,end:edge.to,distance:edge.distance});
  }
  for(const [i,{road,start,end,distance}] of rows.entries()){
    const item=document.createElement('li'),name=document.createElement('strong'),meta=document.createElement('small');
    name.textContent=road.name+'　'+start.name+' → '+end.name;
    meta.textContent=(i?start.name+'で街道を乗り継ぎ · ':'')+roadDistanceLabel(distance)+' · 約'+roadDuration(distance/roadSpeed*60);
    item.append(name,meta);steps.append(item);
  }
  $('roadStatus').textContent=roadDestination
    ? (connected?'約'+roadDuration(minutes)+' · '+roadDistanceLabel(roadJourneys.distances[focus.index])
      : '収録された宿場の接続から経路を見つけられませんでした。')
    : roadHour ? '' : '宿場を選ぶと経路と街道名を表示します。';

  const nearby=$('roadStops');nearby.replaceChildren();
  if(!roadDestination && roadHour){
    const seen=new Set();
    const target=roadHour*60, tolerance=Math.max(20,target*.12);
    for(const stop of [...roadNetwork.stops].sort((a,b)=>Math.abs(roadMinutes(a)-target)-Math.abs(roadMinutes(b)-target))){
      const time=roadMinutes(stop);
      if(Math.abs(time-target)>tolerance)break;
      if(seen.has(stop.hub))continue;
      seen.add(stop.hub);
      const item=document.createElement('li'),button=document.createElement('button'),meta=document.createElement('small');
      button.type='button';button.textContent=stop.name;meta.textContent=roadDuration(time);
      button.append(meta);button.onclick=()=>selectRoadStop(stop,true);item.append(button);nearby.append(item);
      if(seen.size===20)break;
    }
    if(!seen.size)$('roadStatus').textContent='この時間帯に表示できる宿場はありません。';
  }
}

function getRoadWarp() {
  if(roadWarp)return roadWarp;
  const base=roadStart.point, cellSize=24, field=new Map(), ratios=new Float64Array(roadNetwork.stops.length).fill(1);
  for(const stop of roadNetwork.stops){
    const [x,y]=stop.point,distance=Math.hypot(x-base[0],y-base[1]),travel=roadMinutes(stop)/15;
    if(!Number.isFinite(travel)||distance<.001)continue;
    const ratio=travel/distance;
    ratios[stop.index]=ratio;
    const key=Math.floor(x/cellSize)+','+Math.floor(y/cellSize);
    const cell=field.get(key)??{sum:0,count:0};
    cell.sum+=Math.min(4,Math.max(.35,ratio));cell.count++;
    field.set(key,cell);
  }
  const radial=([x,y],ratio)=>[base[0]+(x-base[0])*ratio,base[1]+(y-base[1])*ratio];
  roadWarp={
    stop:stop=>radial(stop.point,ratios[stop.index]),
    point(point){
      const [x,y]=point,col=Math.floor(x/cellSize),row=Math.floor(y/cellSize);
      let sum=.22,weight=.22;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        const cell=field.get((col+dx)+','+(row+dy));
        if(!cell)continue;
        const influence=1/(.25+((col+dx+.5)-x/cellSize)**2+((row+dy+.5)-y/cellSize)**2);
        sum+=influence*cell.sum/cell.count;weight+=influence;
      }
      return radial(point,sum/weight);
    },
  };
  return roadWarp;
}
function roadDisplayPoint(stop){return roadTimeView?getRoadWarp().stop(stop):stop.point;}
function getRoadBackdrop() {
  if(!roadTimeView||!roadStart)return null;
  const warp=getRoadWarp();
  if(!warp.backdrop){
    warp.backdrop={};
    const groups={land:regionCoast,green:parks.map(park=>park.ids),water:rivers.map(river=>river.ids)};
    for(const [key,paths] of Object.entries(groups)){
      const shape=new Path2D();
      for(const path of paths)atlasPath(shape,path.map(id=>warp.point(points[id].geo)),key!=='water');
      warp.backdrop[key]=shape;
    }
  }
  return warp.backdrop;
}
function getRoadTimeShapes(){
  if(roadTimeShapes)return roadTimeShapes;
  const warp=getRoadWarp();
  roadTimeShapes=oldRoadData.map(road=>{
    const paths=road.paths.flatMap((path,i)=>{
      const stops=road.stopsByPath[i];
      if(!stops.length)return [path.map(warp.point)];
      const first=stops[0],last=stops.at(-1),segments=[];
      segments.push([...path.slice(0,first.snap.segment+1).map(warp.point),warp.stop(first)]);
      for(let j=1;j<stops.length;j++)segments.push(roadTripPoints({from:stops[j-1],to:stops[j],road},warp));
      segments.push([warp.stop(last),...path.slice(last.snap.segment+1).map(warp.point)]);
      return segments;
    });
    return roadShape(paths);
  });
  return roadTimeShapes;
}
function roadTripPoints(edge,warp) {
  const points=roadEdgePoints(edge);
  if(!warp)return points;
  const start=warp.stop(edge.from),end=warp.stop(edge.to);
  const a=points[0],b=points.at(-1);
  const length=points.slice(1).reduce((sum,point,i)=>sum+roadDistance(points[i],point),0);
  let travelled=0;
  return points.map((point,i)=>{
    if(i)travelled+=roadDistance(points[i-1],point);
    const fraction=length?travelled/length:(i?1:0);
    return point.map((v,axis)=>v+(start[axis]-a[axis])*(1-fraction)+(end[axis]-b[axis])*fraction);
  });
}
function roadIntersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
function drawRoadLines(bounds,scale) {
  if (!oldRoadData||!roadStart) return;
  const shapes=roadTimeView?getRoadTimeShapes():oldRoadData;
  for(const [i,road] of oldRoadData.entries()){
    if(!roadIntersects(shapes[i].box,bounds))continue;
    ctx.strokeStyle=road.color;ctx.lineWidth=(scale>3?1.9:1.35)/scale;
    ctx.globalAlpha=roadCycling?.22:roadTrip.length?.58:.86;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.stroke(shapes[i].shape);
  }
  if(roadCycling){
    const warp=roadTimeView?getRoadWarp():null;
    const highlights=warp?(warp.cycling??=cyclingShapes(warp)):(cyclingGeoShapes??=cyclingShapes(null));
    ctx.globalAlpha=1;ctx.strokeStyle='#88461c';ctx.lineWidth=(scale>3?2.8:2.4)/scale;
    for(const {shape,box} of highlights)if(roadIntersects(box,bounds))ctx.stroke(shape);
  }
  if(roadTrip.length){
    if(!roadTripShape){
      roadTripShape=new Path2D();
      const warp=roadTimeView?getRoadWarp():null;
      for(const edge of roadTrip)atlasPath(roadTripShape,roadTripPoints(edge,warp));
    }
    ctx.globalAlpha=.95;ctx.strokeStyle='#fbf7eb';ctx.lineWidth=6.4/scale;ctx.stroke(roadTripShape);
    ctx.strokeStyle=transferColor;ctx.lineWidth=3.5/scale;ctx.stroke(roadTripShape);
  }
  ctx.globalAlpha=1;
}
function drawRoadRings(project){
  roadRings=[];
  if(!roadTimeView||!roadStart)return;
  const [x,y]=project(roadStart.point);
  const hours=zoom>.4?[.5,1,2,3,4,6,8,12]:zoom>.12?[2,4,6,8,12,18,24,36]:[6,12,24,48,72,120,168,240];
  for(const hour of hours){
    const radius=hour*4*17*zoom;
    if(radius>Math.hypot(W,H)*1.4)break;
    ctx.beginPath();ctx.setLineDash([3,4]);ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.strokeStyle=hour===roadHour?'#397e72':'#7f9c93';ctx.lineWidth=hour===roadHour?1.7:.8;ctx.stroke();
    let label;
    for(const angle of [-.65,.65,-2.5,2.5]){
      const lx=x+Math.cos(angle)*radius,ly=y+Math.sin(angle)*radius;
      if(lx<8||lx>W-48||ly<108||ly>H-60)continue;
      ctx.font='11px system-ui,sans-serif';
      const name=hour===.5?'30分':hour+'時間';
      const width=ctx.measureText(name).width+10;
      ctx.fillStyle=hour===roadHour?'#246660':'#f7f6ef';ctx.fillRect(lx-3,ly-12,width,17);
      ctx.fillStyle=hour===roadHour?'white':'#42695f';ctx.fillText(name,lx+2,ly);
      label=[lx-3,ly-12,width,17];
      atlasLabels.push([lx-5,ly-14,lx+width-1,ly+7]);break;
    }
    roadRings.push({x,y,radius,hour,label});
  }
  ctx.setLineDash([]);
}
function hitRoadRing(x,y){
  const ring=roadRings.find(({label})=>label&&x>=label[0]&&x<=label[0]+label[2]&&y>=label[1]&&y<=label[1]+label[3])
    ??roadRings.find(r=>Math.abs(Math.hypot(x-r.x,y-r.y)-r.radius)<8);
  return ring?()=>{
    roadHour=ring.hour;roadDestination=null;updateRoadTrip();
  }:null;
}
function drawRoadStops(bounds,project) {
  if(!roadStart)return;
  drawRoadRings(project);
  const plotted=new Set();
  const focus=(stop,radius,color)=>{
    plotted.add(stop.hub);
    atlasDot(project(roadDisplayPoint(stop)),{label:stop.name,color,radius,priority:true,
      action:origin=>origin?setRoadStart(stop):selectRoadStop(stop)});
  };
  focus(roadStart,5,'#d56234');
  if(roadDestination&&roadDestination.hub!==roadStart.hub)focus(roadDestination,5,transferColor);
  for(const step of roadTrip)if(!step.road&&!plotted.has(step.from.hub))focus(step.from,4,transferColor);
  const density=zoom<.08?5:zoom<.18?2:1;
  for(const [i,stop] of roadNetwork.stops.entries()){
    if(plotted.has(stop.hub))continue;
    const [x,y]=roadDisplayPoint(stop);
    if(x<bounds[0]||x>bounds[2]||y<bounds[1]||y>bounds[3])continue;
    plotted.add(stop.hub);
    const hub=roadNetwork.groups.get(stop.hub).length>1;
    atlasDot(project([x,y]),{label:hub||i%density===0?stop.name:null,color:stop.road.color,radius:hub?3.6:zoom<.12?1.8:2.8,
      action:origin=>origin?setRoadStart(stop):selectRoadStop(stop)});
  }
}
function focusSelectedRoad(){
  if(!roadStart)return false;
  centerAtlasPoint(roadDisplayPoint(roadDestination??roadStart));return true;
}
for(const [id,speed] of [['roadWalk',4],['roadHorse',8]])$(id).onclick=()=>{
  roadSpeed=speed;$('roadWalk').setAttribute('aria-pressed',speed===4);$('roadHorse').setAttribute('aria-pressed',speed===8);
  if(roadStart)roadOptionsChanged();
};
for(const [id,key] of [['roadGeo',false],['roadTime',true]])$(id).onclick=()=>{
  roadTimeView=key;
  $('roadGeo').setAttribute('aria-pressed',!key);$('roadTime').setAttribute('aria-pressed',key);
  if(!key)roadHour=null;
  if(roadStart)updateRoadTrip();
};
$('setRoadOrigin').onclick=()=>{if(roadDestination)setRoadStart(roadDestination);};
$('roadCycling').onclick=()=>{
  roadCycling=!roadCycling;
  $('roadCycling').setAttribute('aria-pressed',roadCycling);
  $('roadCyclingNote').hidden=!roadCycling;
  renderCyclingVideos();
  requestDraw();
};
$('roadOrigin').onclick=()=>{
  roadSearchingOrigin=true;roadQuery.value='';roadQuery.placeholder='起点の宿場を検索';
  roadQuery.setAttribute('aria-label','起点の宿場を検索');roadSuggestions.hidden=true;roadQuery.focus();
};
function closeRoadSearch(){
  roadSuggestions.hidden=true;roadSearchingOrigin=false;
  roadQuery.placeholder='宿場を検索';roadQuery.setAttribute('aria-label','宿場を検索');
}
function renderRoadSuggestions(){
  const query=roadQuery.value.trim(),matches=[],seen=new Set();
  if(query){
    for(const stop of roadNetwork?.stops??[]){
      if(!stop.name.includes(query)||seen.has(stop.hub))continue;
      matches.push(stop);seen.add(stop.hub);
    }
    matches.sort((a,b)=>Number(b.name.startsWith(query))-Number(a.name.startsWith(query)));
  }
  roadSuggestions.replaceChildren();
  for(const stop of matches.slice(0,6)){
    const li=document.createElement('li'),button=document.createElement('button'),name=document.createElement('small');
    button.type='button';button.textContent=stop.name;
    name.textContent=[...new Set(roadNetwork.groups.get(stop.hub).map(copy=>copy.road.name))].join('・');
    button.append(name);
    button.onclick=()=>{
      if(roadSearchingOrigin){setRoadStart(stop);roadQuery.value='';}
      else{selectRoadStop(stop,true);roadQuery.value=stop.name;}
      closeRoadSearch();roadQuery.blur();
    };
    li.append(button);roadSuggestions.append(li);
  }
  roadSuggestions.hidden=!matches.length;
}
roadQuery.addEventListener('input',renderRoadSuggestions);
roadQuery.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeRoadSearch();
  if(event.key==='Enter'&&!roadSuggestions.hidden){
    event.preventDefault();roadSuggestions.querySelector('button')?.click();
  }
});
$('railView').addEventListener('pointerdown',event=>{
  if(!event.target.closest('.road-search,#roadOrigin'))closeRoadSearch();
});
