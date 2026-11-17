'use strict';

const roadFilter = $('roadFilter');
const roadQuery = $('roadQuery');
const roadSuggestions = $('roadSuggestions');
const setRoadSheetLevel = bindMapSheet($('roadDock'), $('roadSheetHandle'), $('roadSheetBody'), requestDraw);
const roadColors = ['#a75437','#66598c','#397969','#96652d','#297185','#8d674e'];
let oldRoadData, oldRoadRequest, activeRoad = null, activeStop = null;
setRoadSheetLevel(0);

function loadOldRoads() {
  if (oldRoadData || oldRoadRequest) return;
  $('roadLoading').hidden = false;
  oldRoadRequest = fetch('old-roads.json?v=2').then(response => {
    if (!response.ok) throw Error('roads');
    return response.json();
  }).then(entries => {
    const counts = new Map();
    for (const [, name] of entries) counts.set(name,(counts.get(name)||0)+1);
    oldRoadData = entries.map(([id,name,lines,stops], index) => {
      const shape = new Path2D();
      const box = [Infinity,Infinity,-Infinity,-Infinity];
      for (const line of lines) {
        const coordinates = line.map(geoXY);
        for (const [x,y] of coordinates) {
          box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);
        }
        atlasPath(shape, coordinates);
      }
      const suffix = counts.get(name) > 1 ? '（'+(stops.length ? stops.slice(0,1).concat(stops.slice(-1)).map(stop=>stop[0]).join('〜') : id)+'）' : '';
      const option = document.createElement('option');
      option.value = id;option.textContent = name+suffix;
      roadFilter.append(option);
      return {id,name,color:roadColors[index<5?index:5],shape,box,
        stops:stops.map(([name,serial,region,lon,lat])=>({name,serial,region,point:geoXY([lon,lat])}))};
    });
    renderRoadSheet();
    requestDraw();
  }).catch(() => {
    $('roadStatus').textContent = '街道を読み込めませんでした。地図を切り替えてから開き直してください。';
    setRoadSheetLevel(1);
  }).finally(() => {oldRoadRequest=null;$('roadLoading').hidden=true;});
}

function renderRoadSheet() {
  const list = $('roadStops');
  list.replaceChildren();
  $('roadsTitle').textContent = activeStop?.name ?? activeRoad?.name ?? '旧街道';
  $('roadTerminals').textContent = activeStop
    ? activeRoad.name+' · '+activeStop.region
    : activeRoad ? activeRoad.stops.length+'宿場・地点' : oldRoadData.length+'街道';
  $('roadStatus').textContent = activeRoad
    ? (activeRoad.stops.length ? '' : 'この街道の宿場データはありません。')
    : '街道を選ぶと宿場一覧を表示します。';
  if (!activeRoad) return;
  list.style.setProperty('--road-color',activeRoad.color);
  const items = document.createDocumentFragment();
  for (const stop of activeRoad.stops) {
    const item = document.createElement('li'), button = document.createElement('button');
    const number = document.createElement('small');
    button.type = 'button';
    button.setAttribute('aria-pressed', stop===activeStop);
    number.textContent = /^\d+$/.test(stop.serial) ? stop.serial : '';
    button.append(document.createElement('i'),stop.name,number);
    button.onclick = () => selectRoadStop(activeRoad,stop,true);
    item.append(button);items.append(item);
  }
  list.append(items);
}
function selectRoadStop(road,stop,center=false) {
  const changedRoad=road!==activeRoad;
  activeRoad=road;activeStop=stop;roadFilter.value=road.id;
  if(changedRoad)renderRoadSheet();
  else {
    $('roadsTitle').textContent=stop.name;$('roadTerminals').textContent=road.name+' · '+stop.region;
    [...$('roadStops').children].forEach((item,i)=>item.firstElementChild.setAttribute('aria-pressed',road.stops[i]===stop));
  }
  if(center)centerAtlasPoint(stop.point);
  else requestDraw();
}
roadFilter.onchange = () => {
  if (!oldRoadData) return;
  activeRoad = oldRoadData.find(road=>road.id===roadFilter.value) ?? null;
  activeStop = null;
  roadQuery.value = '';
  renderRoadSheet();$('roadSheetBody').scrollTop=0;
  requestDraw();
};
function focusSelectedRoad(){
  if(activeStop){centerAtlasPoint(activeStop.point);return true;}
  if(!activeRoad)return false;
  centerAtlasPoint([(activeRoad.box[0]+activeRoad.box[2])/2,(activeRoad.box[1]+activeRoad.box[3])/2]);
  return true;
}
function roadIntersects(road,box){
  return road.box[0]<=box[2]&&road.box[2]>=box[0]&&road.box[1]<=box[3]&&road.box[3]>=box[1];
}
function drawRoadLines(bounds,scale) {
  if (!oldRoadData) return;
  const plot = road => {
    if (!roadIntersects(road,bounds)) return;
    const strong = !activeRoad || road===activeRoad;
    ctx.strokeStyle=road.color;
    ctx.lineWidth=(strong?(scale>3?2.3:1.45):1.1)/scale;
    ctx.globalAlpha=strong?.86:.23;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.stroke(road.shape);
  };
  for(const road of oldRoadData)if(road!==activeRoad)plot(road);
  if(activeRoad)plot(activeRoad);
  ctx.globalAlpha=1;
}
function drawRoadStops(bounds,project) {
  if (!oldRoadData) return;
  const roads = activeRoad ? [activeRoad] : oldRoadData;
  if(activeStop)atlasDot(project(activeStop.point),{label:activeStop.name,color:activeRoad.color,radius:5,priority:true});
  const density = zoom<.08 ? 5 : zoom<.18 ? 2 : 1;
  for (const road of roads) {
    if (!roadIntersects(road,bounds)) continue;
    for (const [i,stop] of road.stops.entries()) {
      if(stop===activeStop)continue;
      const [x,y]=stop.point;
      if(x<bounds[0]||x>bounds[2]||y<bounds[1]||y>bounds[3])continue;
      const point=project(stop.point);
      atlasDot(point,{label:i%density===0?stop.name:null,color:road.color,radius:zoom<.12?1.8:2.8,
        action:()=>selectRoadStop(road,stop)});
    }
  }
}
roadQuery.addEventListener('input', () => {
  const query=roadQuery.value.trim(),matches=[];
  if(query){
    for(const road of oldRoadData??[]){
      for(const stop of road.stops)if(stop.name.includes(query))matches.push({road,stop});
    }
    matches.sort((a,b)=>Number(b.stop.name.startsWith(query))-Number(a.stop.name.startsWith(query)));
  }
  roadSuggestions.replaceChildren();
  for(const {road,stop} of matches.slice(0,6)){
    const li=document.createElement('li'),button=document.createElement('button'),name=document.createElement('small');
    button.type='button';button.textContent=stop.name;name.textContent=road.name;
    button.append(name);
    button.onclick=()=>{
      roadQuery.value=stop.name;roadSuggestions.hidden=true;roadQuery.blur();
      selectRoadStop(road,stop,true);
    };
    li.append(button);roadSuggestions.append(li);
  }
  roadSuggestions.hidden=!matches.length;
});
roadQuery.addEventListener('keydown', event => {
  if(event.key==='Escape')roadSuggestions.hidden=true;
  if(event.key==='Enter'&&!roadSuggestions.hidden){
    event.preventDefault();roadSuggestions.querySelector('button')?.click();
  }
});
$('railView').addEventListener('pointerdown', event => {
  if(!event.target.closest('.road-search'))roadSuggestions.hidden=true;
});
