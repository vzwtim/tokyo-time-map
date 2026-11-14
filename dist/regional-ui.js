'use strict';

let overviewMode=null;

function fitRegionalOverview(national=true) {
  wheelZoom=null;
  overviewMode=national;
  set3D(false);
  const names=national?'稚内 網走 根室 札幌 函館 新青森 仙台 東京 新潟 金沢 名古屋 新大阪 岡山 広島 高松 高知 松山 博多 長崎 鹿児島中央 那覇空港 てだこ浦西':'千葉 東京 静岡 名古屋 京都 新大阪 三ノ宮 姫路';
  const anchors=[origin,...names.split(' ').map(name=>S[name]).filter(Number.isInteger)];
  if(!national&&selected!==null)anchors.push(selected);
  const reachable=anchors.filter(id=>Number.isFinite(result.best[id].time));
  const fitIds=mix>.5&&reachable.length>=4?reachable:anchors;
  const positions=fitIds.map(id=>points[stationIndex[id]].target);
  const xs=positions.map(p=>p[0]), ys=positions.map(p=>p[1]);
  const loX=Math.min(...xs), hiX=Math.max(...xs), loY=Math.min(...ys), hiY=Math.max(...ys);
  const bottom=H-20, top=20;
  const scale=Math.max(.12,Math.min((W-76)/Math.max(hiX-loX,1),Math.max(80,bottom-top-30)/Math.max(hiY-loY,1)));
  animation=null;
  for(const p of points)p.from=p.target;
  zoom=scale/17;
  const base=baseScreen();
  pan=[W/2-base[0]-(loX+hiX)/2*scale,(top+bottom)/2-base[1]-(loY+hiY)/2*scale];
  requestDraw();
}

function switchRegion(name) {
  wheelZoom=null;
  overviewMode=null;
  dismissDestination();
  zoom=1;
  set3D(false);
  if(S[name]!==origin)selectOrigin(S[name]);
  updateModel(false,true);
}

function updateBulletComparison(id) {
  const el=$('bulletComparison');
  el.hidden=STATIONS[id].region===STATIONS[origin].region;
  if(el.hidden)return;
  const withBullet=calculate(origin,mode,express,true).best[id].time;
  const without=calculate(origin,mode,express,false).best[id].time;
  const format=n=>Number.isFinite(n)?Math.round(n)+'分':'経路なし';
  el.textContent='新幹線あり '+format(withBullet)+' ／ なし '+format(without);
}

$('regionSelect').onchange=e=>{
  const value=e.target.value;
  if(value==='all')fitRegionalOverview();
  else if(value)switchRegion(value);
  e.target.value='';
  $('mapOptions').open=false;
};
for(const id of ['geoBtn','timeBtn','warpSlider'])$(id).addEventListener(id==='warpSlider'?'change':'click',()=>{
  if(overviewMode!==null)fitRegionalOverview(overviewMode);
});
for(const id of ['zoomIn','zoomOut','reset'])$(id).addEventListener('click',()=>{overviewMode=null;});
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{
  if(overviewMode!==null)fitRegionalOverview(overviewMode);
}).observe(canvas);
canvas.addEventListener('wheel',()=>{overviewMode=null;});
canvas.addEventListener('pointerdown',()=>{overviewMode=null;});

$('shinkansen').onchange=e=>{
  shinkansen=e.target.checked;
  const open=$('routeSteps').open;
  updateModel();
  $('routeSteps').open=open;
};
const stationOptions=new Map();
const byName=new Map();
for(const station of STATIONS) {
  if(!byName.has(station.name))byName.set(station.name,[]);
  byName.get(station.name).push(station);
}
for(const station of STATIONS){
  const duplicates=byName.get(station.name);
  const value=duplicates.length===1?station.name:station.name+'（'+station.region+
    (duplicates.filter(s=>s.region===station.region).length>1?' '+(duplicates.indexOf(station)+1):'')+'）';
  const option=document.createElement('option');
  option.value=value;
  $('stationNames').append(option);
  stationOptions.set(value,station.id);
}
function resolveStationInput(value) {
  const name=value.trim();
  const exact=stationOptions.get(name);
  if(Number.isInteger(exact))return exact;
  const matches=byName.get(name);
  if(matches?.length===1)return matches[0].id;
  // Prefer the main mapped station for same-region duplicate entries.
  if(matches?.every(station=>station.region===matches[0].region)&&matches.some(station=>station.id===S[name]))return S[name];
  return undefined;
}
$('stationInput').oninput=()=>$('stationInput').setCustomValidity('');
$('stationSearch').onsubmit=e=>{
  e.preventDefault();
  const input=$('stationInput'),id=resolveStationInput(input.value);
  if(!Number.isInteger(id)){input.setCustomValidity('候補から駅を選んでください');input.reportValidity();return;}
  if(e.submitter?.value==='destination'){
    showDestination(id);
    if(STATIONS[id].region!==STATIONS[origin].region)fitRegionalOverview(distance(STATIONS[id],STATIONS[origin])>650||STATIONS[id].region==='沖縄'||STATIONS[origin].region==='沖縄');
  } else {
    overviewMode=null;
    if(zoom<.27||STATIONS[id].region!==STATIONS[origin].region)zoom=1;
    selectOrigin(id);
  }
  input.blur();
};


// Geolocation only runs on request. The position stays in this tab.
const mapOptions=$('mapOptions');
document.addEventListener('pointerdown',e=>{
  if(mapOptions.open&&!mapOptions.contains(e.target))mapOptions.open=false;
});
mapOptions.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!mapOptions.open)return;
  e.stopPropagation();
  mapOptions.open=false;
  mapOptions.querySelector('summary').focus();
});

let deviceLocation=null;
let locationStatusTimer;
function showLocationStatus(message,temporary=false){
  const status=$('locationStatus');
  clearTimeout(locationStatusTimer);
  status.textContent=message;
  if(temporary)locationStatusTimer=setTimeout(()=>{status.textContent='';},6500);
}

function centerDeviceLocation(position) {
  wheelZoom=null;
  deviceLocation={lon:position.coords.longitude,lat:position.coords.latitude,accuracy:position.coords.accuracy};
  overviewMode=null;
  dismissDestination();
  set3D(false);
  viewMotion=null;
  changeMix(0,false);
  zoom=Math.max(zoom,1.5);
  const anchor=xy(STATIONS[origin]),point=xy(deviceLocation),scale=17*zoom;
  pan=[(anchor[0]-point[0])*scale,(anchor[1]-point[1])*scale];
  requestDraw();
}

function drawDeviceLocation(projection){
  if(!deviceLocation||mix!==0)return;
  const anchor=xy(STATIONS[origin]),point=xy(deviceLocation);
  const [x,y]=projection([point[0]-anchor[0],point[1]-anchor[1]]);
  if(!visible([x,y],0))return;
  const radius=Math.min(80,deviceLocation.accuracy/1000*17*zoom);
  if(radius>9){
    ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fillStyle='#2563eb22';ctx.fill();
  }
  ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);
  ctx.fillStyle='#1d63cc';ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
}

const locateButton=$('locateMe');
locateButton.onclick=()=>{
  if(!navigator.geolocation){
    showLocationStatus('この環境では現在地を取得できません。',true);
    return;
  }
  locateButton.disabled=true;
  locateButton.setAttribute('aria-busy','true');
  showLocationStatus('現在地を取得中…');
  const done=()=>{
    locateButton.disabled=false;
    locateButton.removeAttribute('aria-busy');
  };
  navigator.geolocation.getCurrentPosition(position=>{
    done();
    centerDeviceLocation(position);
    showLocationStatus('現在地を地理表示で表示しました。',true);
  },error=>{
    done();
    const message=error.code===1?'位置情報を許可すると現在地を表示できます。':
      error.code===3?'現在地の取得がタイムアウトしました。':'現在地を取得できませんでした。';
    showLocationStatus(message,true);
  },{maximumAge:60000,timeout:10000});
};
