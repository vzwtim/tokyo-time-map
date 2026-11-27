'use strict';

const roadQuery = $('roadQuery'), roadSuggestions = $('roadSuggestions');
const setRoadSheetLevel = bindMapSheet($('roadDock'), $('roadSheetHandle'), $('roadSheetBody'), requestDraw);
const roadColors = ['#a75437','#66598c','#397969','#96652d','#297185','#8d674e'];
const transferColor='#8d5533';
let oldRoadData, oldRoadRequest, roadNetwork, roadJourneys, roadStart, roadDestination;
let roadSpeed=4, roadSearchingOrigin=false;
let roadTrip=[], roadTripShape=null;
const cyclingEpisodes=[
  ['R002','日本橋','高崎','LTbuy5TDnkM',{日本橋:'0:33', 板橋:'1:49', 蕨:'2:40', 浦和:'3:29', 大宮:'3:54', 上尾:'4:45', 桶川:'4:56', 鴻巣:'5:29', 熊谷:'6:47', 深谷:'7:41', 本庄:'8:49', 新町:'9:35', 倉賀野:'10:03', 高崎:'10:16'}],
  ['R002','高崎','岩村田','p7tof_9LEGA',{高崎:'0:46', 板鼻:'1:16', 安中:'1:49', 松井田:'2:52', 坂本:'6:02', 軽井沢:'11:02', 沓掛:'11:50', 追分:'12:11', 小田井:'13:29', 岩村田:'13:59'}],
  ['R002','塩名田','下諏訪','PohYcbxYwqU',{塩名田:'1:21', 八幡:'1:53', 望月:'3:07', 芦田:'4:50', 長久保:'6:48', 和田:'8:00', 下諏訪:'17:00'}],
  ['R002','下諏訪','福島','oTAyAkobTko',{下諏訪:'1:08', 塩尻:'2:34', 洗馬:'3:14', 本山:'3:37', 贄川:'4:43', 奈良井:'7:00', 藪原:'11:15', 宮ノ越:'12:47', 福島:'14:43'}],
  ['R002','福島','馬籠','AV41DNDRaMk',{福島:'1:08', 上松:'2:34', 須原:'5:54', 野尻:'7:44', 三留野:'9:31', 妻籠:'11:29', 馬籠:'15:54'}],
  ['R002','馬籠','太田','seXxnPMgR0E',{馬籠:'0:56', 落合:'1:43', 中津川:'2:32', 大井:'3:44', 大湫:'8:02', 細久手:'9:09', 御嶽:'13:41', 伏見:'14:27', 太田:'15:53'}],
  ['R002','太田','鳥居本','FBEtIdYx5T0',{太田:'0:46', 鵜沼:'2:04', 加納:'3:02', 河渡:'3:21', 美江寺:'3:41', 赤坂:'4:20', 垂井:'4:40', 関ヶ原:'5:11', 今須:'5:38', 柏原:'6:52', 醒井:'7:31', 番場:'7:57', 鳥居本:'8:11'}],
  ['R002','高宮','三条大橋','vdv1KIftjIU',{高宮:'0:50', 愛知川:'1:17', 武佐:'2:16', 守山:'3:44', 草津:'4:21', 大津:'6:48', 三条大橋:'8:28'}],
  ['R004','宇都宮','白河','2v_vI3E9cts',{}],
];
let roadCycling=false;
const cyclingByHub=new Map();
const riddenRoads=new Set(['R001','R002','R003','R005','R303','R312']);
const riddenSections=[['R004','日本橋','白河'],['R222','今市','大内']];
const cyclingMapEpisodes=[];
const riddenHubs=new Set();
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
  oldRoadRequest = Promise.all(['old-roads.json?v=4','old-roads-extra.json?v=2'].map(url=>fetch(url).then(response=>{
    if(!response.ok)throw Error('roads');
    return response.json();
  }))).then(parts => {
    const entries=parts.flat();
    oldRoadData = mergeRoadEntries(entries).map(([id,name,lines,stops],index)=>{
      const paths=lines.map(line=>line.map(geoXY));
      return {id,name,paths,color:roadColors[index<5?index:5],...roadShape(paths),
        stops:stops.map(([name,serial,region,lon,lat,hub,meta={}])=>({name,region,hub,kind:meta.kind??(serial==='S'||String(serial).startsWith('E')?'endpoint':name.endsWith('峠')?'pass':'post'),representative:!!meta.representative,point:geoXY([lon,lat])}))};
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
  riddenHubs.clear();
  cyclingGeoShapes=null;
  const partialStops=riddenSections.map(section=>cyclingSection(...section));
  cyclingSegments=partialStops.flatMap(stops=>stops.slice(1).map((to,i)=>({road:to.road,from:stops[i],to})));
  cyclingMapEpisodes.length=0;
  for(const road of oldRoadData)if(riddenRoads.has(road.id)){
    for(const stop of road.stops)riddenHubs.add(stop.hub);
  }
  for(const stop of partialStops.flat())riddenHubs.add(stop.hub);
  for(const [roadId,first,last,video,chapters] of cyclingEpisodes){
    const stops=cyclingSection(roadId,first,last);
    if(stops.length)cyclingMapEpisodes.push({video,road:stops[0].road.name,first,last,stops});
    for(const stop of stops){
      const episodes=cyclingByHub.get(stop.hub)??[];
      episodes.push({video,chapter:chapters[stop.name],road:stop.road.name,first,last});
      cyclingByHub.set(stop.hub,episodes);
    }
  }
}
function cyclingSection(roadId,first,last){
    const road=oldRoadData.find(entry=>entry.id===roadId);
    const stops=road?.stopsByPath.find(path=>path.some(stop=>stop.name===first)&&path.some(stop=>stop.name===last));
    if(!stops)return [];
    const endpoints=[first,last].map(name=>stops.findIndex(stop=>stop.name===name)).sort((a,b)=>a-b);
    return stops.slice(endpoints[0],endpoints[1]+1);
}

function cyclingShapes(){
  return roadShape(cyclingSegments.map(roadEdgePoints));
}

function renderCyclingVideos(){
  const list=$('roadVideos');
  const stop=roadDestination??roadStart;
  const videos=roadCycling&&stop?(cyclingByHub.get(stop.hub)??[]):[];
  list.replaceChildren();
  list.hidden=!videos.length;
  for(const {video,chapter,road,first,last} of [...videos].sort((a,b)=>Number(!!b.chapter)-Number(!!a.chapter))){
    const link=document.createElement('a');
    const seconds=chapter?.split(':').reduce((total,part)=>total*60+Number(part),0);
    link.href='https://www.youtube.com/watch?v='+video+(chapter?'&t='+seconds+'s':'');
    link.target='_blank';
    link.rel='noopener';
    link.className='road-video-link';
    link.setAttribute('aria-label',(chapter?stop.name+'の場面 '+chapter:'区間の動画')+'をYouTubeで見る（'+road+' '+first+'〜'+last+'）');
    link.title=road+' '+first+'〜'+last;
    link.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16l13-8Z"/></svg>';
    link.append(chapter?'宿場の場面を見る':'区間の動画を見る');
    if(chapter){
      const time=document.createElement('small');
      time.textContent=chapter;
      link.append(time);
    }
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
  updateRoadTrip();
}
function setRoadStart(stop,recenter=true) {
  roadStart=stop;roadDestination=null;
  roadJourneys=routeOldRoads(roadNetwork,stop);
  $('roadOrigin').textContent=stop.name+' ▾';
  roadOptionsChanged();
  if(recenter)centerAtlasPoint(stop.point);
}
function selectRoadStop(stop,center=false) {
  roadDestination=stop;
  updateRoadTrip();
  $('roadSheetBody').scrollTop=0;
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
  $('roadsTitle').textContent=roadDestination?roadStart.name+' → '+focus.name:roadStart.name+'から';
  $('roadTerminals').textContent=roadDestination?(connected?'約'+roadDuration(minutes):'経路なし'):(roadSpeed===4?'徒歩':'馬')+' · '+oldRoadData.length+'街道';
  $('roadActions').hidden=!roadDestination||roadDestination.hub===roadStart.hub;
  const memberList=$('roadMembers');
  memberList.replaceChildren();
  if(roadDestination){
    const kinds={post:'宿場・継立場',tea:'茶屋',gate:'門',town:'城下',waypoint:'経由地',junction:'分岐・合流',endpoint:'起終点',pass:'峠'};
    const role=document.createElement('span');role.textContent=(kinds[focus.kind]??'地点')+(focus.representative?' · 概略位置':'');memberList.append(role);
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
      : 'この区間は収録線がつながっていません。近くの宿場を起点にできます。')
    : '宿場を選ぶと経路と街道名を表示します。';

}

function roadDisplayPoint(stop){return stop.point;}
function roadIntersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
function drawRoadLines(bounds,scale) {
  if (!oldRoadData||!roadStart) return;
  const shapes=oldRoadData;
  for(const [i,road] of oldRoadData.entries()){
    if(roadCycling&&riddenRoads.has(road.id))continue;
    if(!roadIntersects(shapes[i].box,bounds))continue;
    ctx.strokeStyle=roadCycling?'#87938a':road.color;ctx.lineWidth=(scale>3?1.9:1.35)/scale;
    ctx.globalAlpha=roadCycling?.45:roadTrip.length?.58:.86;ctx.lineCap='round';ctx.lineJoin='round';
    if(roadCycling)ctx.setLineDash([2/scale,4/scale]);
    ctx.stroke(shapes[i].shape);
  }
  ctx.setLineDash([]);
  if(roadCycling){
    const highlights=cyclingGeoShapes??=cyclingShapes();
    const riddenShapes=shapes.filter((_,i)=>riddenRoads.has(oldRoadData[i].id));
    riddenShapes.push(highlights);
    const onScreen=riddenShapes.filter(({box})=>roadIntersects(box,bounds));
    ctx.globalAlpha=1;
    ctx.strokeStyle='#faf9f2';ctx.lineWidth=6.4/scale;
    for(const {shape} of onScreen)ctx.stroke(shape);
    ctx.strokeStyle='#145c4c';ctx.lineWidth=3.9/scale;
    for(const {shape} of onScreen)ctx.stroke(shape);
  }
  if(roadTrip.length){
    if(!roadTripShape){
      roadTripShape=new Path2D();
      for(const edge of roadTrip)atlasPath(roadTripShape,roadEdgePoints(edge));
    }
    ctx.globalAlpha=.95;
    if(roadCycling){
      ctx.setLineDash([1/scale,5/scale]);
      ctx.strokeStyle='#f4c66f';ctx.lineWidth=1.6/scale;ctx.stroke(roadTripShape);
    }else{
      ctx.strokeStyle='#fbf7eb';ctx.lineWidth=6.4/scale;ctx.stroke(roadTripShape);
      ctx.strokeStyle=transferColor;ctx.lineWidth=3.5/scale;ctx.stroke(roadTripShape);
    }
    ctx.setLineDash([]);
  }
  ctx.globalAlpha=1;
}
function drawRoadStops(bounds,project) {
  if(!roadStart)return;
  const plotted=new Set();
  const focus=(stop,radius,color)=>{
    plotted.add(stop.hub);
    atlasDot(project(roadDisplayPoint(stop)),{label:stop.name,color,radius,priority:true,
      action:origin=>origin?setRoadStart(stop):selectRoadStop(stop)});
  };
  focus(roadStart,5,'#d56234');
  if(roadDestination&&roadDestination.hub!==roadStart.hub)focus(roadDestination,5,transferColor);
  for(const step of roadTrip)if(!step.road&&!step.from.junction&&!plotted.has(step.from.hub))focus(step.from,4,transferColor);
  const density=zoom<.08?5:zoom<.18?2:1;
  for(const [i,stop] of roadNetwork.stops.entries()){
    if(plotted.has(stop.hub))continue;
    const [x,y]=roadDisplayPoint(stop);
    if(x<bounds[0]||x>bounds[2]||y<bounds[1]||y>bounds[3])continue;
    plotted.add(stop.hub);
    const hub=roadNetwork.groups.get(stop.hub).length>1;
    const ridden=roadCycling&&riddenHubs.has(stop.hub);
    if(roadCycling&&!ridden)ctx.globalAlpha=.48;
    atlasDot(project([x,y]),{label:hub||i%density===0?stop.name:null,color:roadCycling?(ridden?'#145c4c':'#87938a'):stop.road.color,radius:hub?3.6:stop.kind==='waypoint'?1.7:zoom<.12?1.8:2.8,subtle:stop.kind==='waypoint',
      action:origin=>origin?setRoadStart(stop):selectRoadStop(stop)});
    ctx.globalAlpha=1;
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
$('setRoadOrigin').onclick=()=>{if(roadDestination)setRoadStart(roadDestination);};
$('roadCycling').onclick=()=>{
  roadCycling=!roadCycling;
  $('roadCycling').setAttribute('aria-pressed',roadCycling);
  $('roadCyclingNote').hidden=!roadCycling;
  renderCyclingVideos();
  if(!roadCycling)closeRoadVideo();
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
      if(!(stop.name.includes(query)||(query.endsWith('宿')&&stop.name===query.slice(0,-1)))||seen.has(stop.hub))continue;
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

const roadVideoPins=new Map();
function closeRoadVideo(){
  $('roadVideoPlayer').hidden=true;
  $('roadVideoFrame').replaceChildren();
}
function openRoadVideo(episode,chapter){
  const seconds=chapter?chapter.split(':').reduce((sum,part)=>sum*60+Number(part),0):0;
  const title=episode.road+' '+episode.first+'〜'+episode.last;
  $('roadVideoTitle').textContent=title;
  $('roadVideoExternal').href='https://www.youtube.com/watch?v='+episode.video+(seconds?'&t='+seconds+'s':'');
  const frame=document.createElement('iframe');
  frame.title=title+'の動画';
  frame.src='https://www.youtube-nocookie.com/embed/'+episode.video+'?autoplay=1'+(seconds?'&start='+seconds:'');
  frame.allow='autoplay; encrypted-media; picture-in-picture';
  frame.allowFullscreen=true;
  frame.referrerPolicy='strict-origin-when-cross-origin';
  $('roadVideoFrame').replaceChildren(frame);
  $('roadVideoPlayer').hidden=false;
}
$('roadVideoClose').onclick=closeRoadVideo;
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeRoadVideo();});
function renderRoadMapVideos(project){
  const holder=$('roadVideoCards');
  holder.hidden=!roadCycling||mapView!=='roads';
  if(holder.hidden)return;
  const occupied=[],shown=new Set();
  const bottom=H-Math.max(48,$('roadDock').offsetHeight);
  for(const episode of cyclingMapEpisodes){
    if(shown.size===4)break;
    // Use a visible post within the interval; retain the same geographic anchor while panning.
    const candidates=episode.stops.map(stop=>({stop,point:project(stop.point)})).filter(({point:[x,y]})=>x>44&&x<W-74&&y>160&&y<bottom-34);
    const candidate=candidates[Math.floor(candidates.length/2)];
    if(!candidate)continue;
    const [x,y]=candidate.point;
    const box=[x-38,y-62,x+38,y-8];
    if(occupied.some(b=>box[0]<b[2]+12&&box[2]>b[0]-12&&box[1]<b[3]+12&&box[3]>b[1]-12))continue;
    occupied.push(box);shown.add(episode.video);
    let button=roadVideoPins.get(episode.video);
    if(!button){
      button=document.createElement('button');button.type='button';button.className='road-video-pin';
      button.setAttribute('aria-label',episode.road+' '+episode.first+'〜'+episode.last+'の動画を再生');
      const image=document.createElement('img');image.src='https://i.ytimg.com/vi/'+episode.video+'/mqdefault.jpg';image.alt='';image.loading='lazy';image.decoding='async';
      const play=document.createElement('span');play.className='road-video-play';play.textContent='▶';play.setAttribute('aria-hidden','true');
      const label=document.createElement('small');label.textContent=episode.first+'〜'+episode.last;
      button.append(image,play,label);button.onclick=()=>openRoadVideo(episode);
      holder.append(button);roadVideoPins.set(episode.video,button);
    }
    button.hidden=false;button.style.transform='translate('+Math.round(x-38)+'px,'+Math.round(y-62)+'px)';
  }
  for(const [id,button] of roadVideoPins)button.hidden=!shown.has(id);
}
