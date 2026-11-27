'use strict';

const planner = $('stationPlanner');
const plannerInput = $('plannerInput');
const plannerPeople = {living:[],meeting:[]};
let plannerDecisionId = null, householdRentPromise;
let pendingPlannerId = null;
let plannerEditingIndex = null;
const yen = new Intl.NumberFormat('ja-JP');
let plannerMode = 'living', plannerSearch = null, plannerRevision = 0;
let meetingOrder = 'longest';
let plannerCandidates = [], pickedPlannerId = null;
const setPlannerSheetLevel = bindMapSheet(planner, $('plannerSheetHandle'), $('plannerSheetBody'), requestDraw);
setPlannerSheetLevel(0);

// --- みんなで入れるルーム（飲む駅） -------------------------------------
// ルーム式：リンクは1つだけ（?room=ID）。開いた人が自分の駅を足すとサーバー
// （Worker + Durable Object）に保存され、開いている全員の画面に自動で反映される。
// ルームが作れない環境では、駅IDをURLに載せる旧リンク方式（?nomu=）に落とす。
const NOMU_LINK_MAX = 12;
let nomuRoomId = null;
try { nomuRoomId = new URLSearchParams(location.search).get('room') || null; } catch {}
let nomuRoomBusy = false, nomuRoomTimer = null;
function validNomuIds(list) {
  const ids = [];
  for (const value of list ?? []) {
    const id = Number(value);
    if (Number.isInteger(id) && STATIONS[id] && !ids.includes(id)) ids.push(id);
    if (ids.length >= NOMU_LINK_MAX) break;
  }
  return ids;
}
function nomuIdsFromUrl() {
  try {
    const raw = new URLSearchParams(location.search).get('nomu');
    return raw ? validNomuIds(raw.split(',')) : [];
  } catch { return []; }
}
function nomuUrl(ids) {
  const url = new URL(location.href);
  url.searchParams.delete('nomu');
  if (nomuRoomId) url.searchParams.set('room', nomuRoomId);
  else {
    url.searchParams.delete('room');
    if (ids.length) url.searchParams.set('nomu', ids.join(','));
  }
  url.hash = 'meeting';
  return url.toString();
}
function lineShareUrl(url) {
  return 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url);
}
async function nomuApi(path, options) {
  const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
  if (!response.ok) throw Error('room api');
  return response.json();
}
async function ensureNomuRoom() {
  if (nomuRoomId) return nomuRoomId;
  const data = await nomuApi('/api/rooms', {
    method: 'POST', body: JSON.stringify({ stations: plannerPeople.meeting }),
  });
  nomuRoomId = data.id;
  startNomuRoomPolling();
  updatePlannerShare();
  return nomuRoomId;
}
function adoptNomuRoom(stations, announce = true) {
  if (plannerEditingIndex !== null) return;
  const ids = validNomuIds(stations);
  if (JSON.stringify(ids) === JSON.stringify(plannerPeople.meeting)) return;
  const grew = ids.length > plannerPeople.meeting.length;
  plannerPeople.meeting = ids;
  if (plannerMode === 'meeting' && !planner.hidden) {
    invalidatePlanner();
    if (announce && grew) showPlannerMessage(ids.length + '人の駅がそろっています。');
  }
}
async function syncNomuRoom(action, stationId) {
  if (!nomuRoomId || plannerMode !== 'meeting') return;
  nomuRoomBusy = true;
  try {
    const data = await nomuApi('/api/rooms/' + nomuRoomId + '/' + action, {
      method: 'POST', body: JSON.stringify({ id: stationId }),
    });
    adoptNomuRoom(data.stations, false);
  } catch {
    showPlannerMessage('同期できませんでした。つながったら自動で反映されます。');
  } finally { nomuRoomBusy = false; }
}
async function pollNomuRoom() {
  if (!nomuRoomId || nomuRoomBusy || document.hidden) return;
  try {
    const data = await nomuApi('/api/rooms/' + nomuRoomId);
    adoptNomuRoom(data.stations);
  } catch {}
}
function startNomuRoomPolling() {
  if (nomuRoomTimer || !nomuRoomId) return;
  nomuRoomTimer = setInterval(pollNomuRoom, 3000);
  pollNomuRoom();
}
function updatePlannerShare() {
  const share = $('plannerShare');
  if (!share) return;
  const meeting = plannerMode === 'meeting';
  share.hidden = !meeting;
  if (!meeting) return;
  $('plannerLineShare').href = lineShareUrl(nomuUrl(plannerPeople.meeting));
  try { history.replaceState(null, '', nomuUrl(plannerPeople.meeting)); } catch {}
}
$('plannerCopyLink').onclick = async () => {
  try { await ensureNomuRoom(); } catch {}
  try {
    await navigator.clipboard.writeText(nomuUrl(plannerPeople.meeting));
    showPlannerMessage(nomuRoomId
      ? 'ルームのリンクをコピーしました。LINEに貼って送ってね。開いた人が駅を足せば自動で反映されます。'
      : 'リンクをコピーしました。LINEに貼って送ってね。');
  } catch {
    showPlannerMessage('コピーできませんでした。アドレスバーのURLを送ってね。');
  }
};
$('plannerLineShare').onclick = async event => {
  if (nomuRoomId) return;
  event.preventDefault();
  try { await ensureNomuRoom(); } catch {}
  window.open(lineShareUrl(nomuUrl(plannerPeople.meeting)), '_blank', 'noopener');
};
const nomuSeedIds = nomuIdsFromUrl();
if (nomuRoomId) {
  if (!location.hash) { try { history.replaceState(null, '', '#meeting'); } catch {} }
  window.addEventListener('DOMContentLoaded', () => {
    startNomuRoomPolling();
    setTimeout(() => {
      if (plannerMode === 'meeting' && !planner.hidden) {
        showPlannerMessage('ルームに参加しました。あなたの駅を追加してね。追加は自動でみんなに反映されます。');
        updatePlannerShare();
      }
    }, 0);
  });
} else if (nomuSeedIds.length) {
  plannerPeople.meeting = nomuSeedIds;
  if (!location.hash) { try { history.replaceState(null, '', '#meeting'); } catch {} }
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    if (plannerMode === 'meeting' && !planner.hidden) {
      showPlannerMessage(nomuSeedIds.length + '人の駅をリンクから読み込みました。あなたの駅を追加してね。');
      updatePlannerShare();
    }
  }, 0));
}

function rankPlannerStations(stations, journeys, {rents, cap, budget, order}) {
  return stations.flatMap(station => {
    const minutes = journeys.map(journey => journey.best[station.id].time);
    if (!minutes.every(Number.isFinite)) return [];
    const longest = Math.max(...minutes);
    const rent = rents?.[station.id]?.[0];
    if (rents && (!rent || rent > budget || longest > cap)) return [];
    const total = minutes.reduce((sum, time) => sum + time, 0);
    return [{station, minutes, longest, total, rent}];
  }).sort((a, b) => (order === 'total' ? a.total - b.total || a.longest - b.longest : a.longest - b.longest || a.total - b.total)
    || (a.rent || 0) - (b.rent || 0) || a.station.id - b.station.id);
}

function setPlannerLoading(loading) {
  $('plannerLoading').hidden = !loading;
  $('plannerRun').disabled = loading;
  $('plannerRun').hidden = true;
  planner.setAttribute('aria-busy',loading);
}

function openPlanner(kind) {
  plannerRevision++;
  plannerSearch = null;
  plannerMode = kind;
  const living = kind === 'living';
  planner.dataset.mode = kind;
  $('plannerTitle').textContent = living ? '住む駅' : '飲む駅';
  $('plannerMeta').textContent = '駅を追加';
  $('livingControls').open = false;
  $('plannerTools').dataset.mode = kind;
  $('plannerTools').hidden = false;
  plannerCandidates = [];
  pickedPlannerId = null;
  plannerEditingIndex=null;
  plannerInput.value = '';
  clearPlannerSelection();
  plannerInput.setCustomValidity('');
  $('livingControls').hidden = !living;
  $('meetingControls').hidden = living;
  $('drinkPreferences').hidden = living;
  $('plannerFeedback').hidden=true;
  plannerDecisionId=null;
  $('plannerStatus').textContent = '';
  $('plannerResults').replaceChildren();
  $('sumuLink').hidden = !living;
  $('plannerNote').textContent = living ? '東京圏の掲載相場を使用 · 通勤時間は反対方向の経路を使った概算' : '所要時間は概算 · 新幹線を除く';
  setPlannerLoading(false);
  renderPlannerPeople();
  planner.hidden = false;
  setPlannerSheetLevel(0);
  if(plannerPeople[kind].length>=2)updatePlannerCandidates();
}

function closePlanner() {
  plannerRevision++;
  plannerEditingIndex=null;
  clearPlannerSelection();
  planner.hidden = true;
  $('plannerTools').hidden=true;
}

function renderPlannerResults() {
  if (!plannerSearch) return;
  const {living, ids, journeys, household} = plannerSearch;
  const order = living ? 'longest' : meetingOrder;
  const available=living?STATIONS:STATIONS.filter(matchesDrinkPreferences);
  const rows = rankPlannerStations(available, journeys, {
    rents: living ? STATIONS.map(station=>householdRecord(household,station)) : null,
    budget: ($('plannerBudget').valueAsNumber || Infinity) * 10000,
    cap: $('plannerCap').valueAsNumber || Infinity,
    order,
  });
  const candidates = [];
  for (const row of rows) {
    const duplicate = candidates.some(({station}) =>
      station.name === row.station.name && station.region === row.station.region && distance(station, row.station) < .75);
    if (!duplicate) candidates.push(row);
    if (candidates.length === 8) break;
  }
  plannerCandidates = candidates;
  if (!candidates.some(row=>row.station.id===pickedPlannerId)) pickedPlannerId = candidates[0]?.station.id ?? null;
  const list = $('plannerResults');
  updatePlannerSummary();
  if(!candidates.some(row=>row.station.id===plannerDecisionId))plannerDecisionId=null;
  list.replaceChildren();
  $('plannerStatus').textContent = rows.length ? ''
    : (living ? '条件に合う家賃データがありません。家賃か片道の上限を調整してください。'
      :drinkPreference.vibe||drinkPreference.drink?'この条件に合う収録済みの街がありません。「すべて」で条件を戻せます。'
      :'全員が鉄道で行ける駅が見つかりませんでした。');
  if(!living)$('plannerNote').textContent=(drinkPreference.vibe||drinkPreference.drink
    ?'街ガイド・店舗情報のある駅で絞り込み · 雰囲気は街の傾向':'所要時間は概算 · 新幹線を除く');
  for (const [index, {station, minutes, longest, total, rent}] of candidates.entries()) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const name = document.createElement('strong');
    const detail = document.createElement('small');
    const amount = document.createElement('span');
    const other = document.createElement('small');
    const sameName = byName.get(station.name);
    const nearbyDuplicates = sameName?.every(match => match.region === station.region && distance(station, match) < .75);
    name.textContent = (index + 1) + '　' + (nearbyDuplicates ? station.name : stationLabels[station.id] ?? station.name);
    detail.textContent = minutes.map((time, i) => STATIONS[ids[i]].name + ' ' + Math.round(time) + '分').join(' ／ ');
    amount.textContent = order === 'total' ? '合計 '+Math.round(total)+'分' : '最長 '+Math.round(longest)+'分';
    other.textContent = living ? layoutShort()+' '+yen.format(rent)+'円／月'
      : (order === 'total' ? '最長 '+Math.round(longest)+'分' : '合計 '+Math.round(total)+'分');
    button.type = 'button';
    button.dataset.candidate = station.id;
    button.setAttribute('aria-pressed',station.id===pickedPlannerId);
    button.setAttribute('aria-expanded',station.id===plannerDecisionId);
    button.append(name,amount,detail,other);
    button.onclick = () => selectPlannerCandidate(station.id,false,true);
    if(station.id===plannerDecisionId)button.setAttribute('aria-controls','plannerDecision');
    li.append(button);
    list.append(li);
  }
  updatePlannerDecision();
  requestDraw();
}

function selectPlannerCandidate(id,center=false,toggle=false) {
  pickedPlannerId = id;
  plannerDecisionId = toggle && plannerDecisionId===id ? null : id;
  for (const b of $('plannerResults').querySelectorAll('button')) {
    b.setAttribute('aria-pressed',Number(b.dataset.candidate)===id);
    const expanded=Number(b.dataset.candidate)===plannerDecisionId;
    b.setAttribute('aria-expanded',expanded);
    if(expanded)b.setAttribute('aria-controls','plannerDecision');
    else b.removeAttribute('aria-controls');
  }
  updatePlannerSummary();
  updatePlannerDecision();
  if(center)centerAtlasPoint(points[stationIndex[id]].geo);
  else requestDraw();
}
function updatePlannerSummary(){
  const row=plannerCandidates.find(entry=>entry.station.id===pickedPlannerId);
  $('plannerMeta').textContent=row
    ?row.station.name+' · '+(plannerMode==='meeting'&&meetingOrder==='total'?'合計 '+Math.round(row.total):'最長 '+Math.round(row.longest))+'分'
    :'条件を調整';
}
function focusPlannerResults(){
  if(!plannerCandidates.length)return false;
  const ids=[...plannerSearch.ids,...plannerCandidates.slice(0,4).map(row=>row.station.id)];
  const locations=ids.map(id=>points[stationIndex[id]].geo);
  const xs=locations.map(point=>point[0]),ys=locations.map(point=>point[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  zoom=Math.min(1,Math.max(.02,Math.min((W-80)/Math.max(10,maxX-minX),Math.max(120,H-$('stationPlanner').offsetHeight-120)/Math.max(10,maxY-minY))/17));
  centerAtlasPoint([(minX+maxX)/2,(minY+maxY)/2]);
  pan[1]-=$('stationPlanner').offsetHeight/2;
  requestDraw();
  return true;
}
const plannerColors=['#456e8d','#945970','#657b40','#9a6a31','#6f5c8e','#367b79'];
const plannerColor=i=>plannerColors[i%plannerColors.length];
const plannerGridSize=18;
let plannerStationGrid;
function nearbyPlannerStations(bounds){
  if(zoom<.24 || (bounds[2]-bounds[0])*(bounds[3]-bounds[1])>30000)return majorStations;
  if(!plannerStationGrid){
    plannerStationGrid=new Map();
    for(const id of STATIONS.keys()){
      const [x,y]=points[stationIndex[id]].geo;
      const key=Math.floor(x/plannerGridSize)+','+Math.floor(y/plannerGridSize);
      if(!plannerStationGrid.has(key))plannerStationGrid.set(key,[]);
      plannerStationGrid.get(key).push(id);
    }
  }
  const ids=[];
  const [x0,y0,x1,y1]=bounds.map(value=>Math.floor(value/plannerGridSize));
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)ids.push(...(plannerStationGrid.get(x+','+y)??[]));
  return ids;
}
function drawPlannerMap(project,bounds) {
  const ids=plannerPeople[plannerMode];
  const color=plannerMode==='living'?'#2c745d':'#a56b25';
  if(plannerSearch&&pickedPlannerId!==null){
    for(const [i,journey] of plannerSearch.journeys.entries()){
      const steps=journey.route(pickedPlannerId);
      ctx.beginPath();ctx.strokeStyle=plannerColor(i);ctx.lineWidth=2.1;ctx.globalAlpha=.75;
      for(const step of steps){
        ctx.moveTo(...project(points[stationIndex[step.from]].geo));
        ctx.lineTo(...project(points[stationIndex[step.to]].geo));
      }
      ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  for(const [i,id] of ids.entries()){
    atlasDot(project(points[stationIndex[id]].geo),{label:STATIONS[id].name,color:plannerColor(i),radius:5,priority:true,
      action:()=>stagePlannerStation(id)});
  }
  if(pendingPlannerId!==null){
    atlasDot(project(points[stationIndex[pendingPlannerId]].geo),{
      label:STATIONS[pendingPlannerId].name,color,radius:7,priority:true,action:()=>stagePlannerStation(pendingPlannerId)});
  }
  const candidateIds=new Set(plannerCandidates.map(row=>row.station.id));
  for(const {station} of plannerCandidates){
    const [x,y]=project(points[stationIndex[station.id]].geo);
    atlasLabels.push([x-11,y-11,x+11,y+11]);
  }
  for(const [index,{station}] of plannerCandidates.entries()){
    if(station.id===pendingPlannerId)continue;
    const point=project(points[stationIndex[station.id]].geo);
    atlasDot(point,{label:(index+1)+' '+station.name,rank:index+1,color,radius:station.id===pickedPlannerId?10:8.5,
      priority:true,action:()=>selectPlannerCandidate(station.id)});
  }
  for(const id of nearbyPlannerStations(bounds)){
    if(ids.includes(id)||id===pendingPlannerId||candidateIds.has(id))continue;
    const point=project(points[stationIndex[id]].geo);
    if(atlasLabels.some(b=>point[0]>=b[0]-2&&point[0]<=b[2]+2&&point[1]>=b[1]-2&&point[1]<=b[3]+2))continue;
    atlasDot(point,{label:zoom>(plannerCandidates.length?.9:.55)?STATIONS[id].name:null,color:'#91a499',radius:1.3,subtle:true,
      action:()=>stagePlannerStation(id)});
  }
}

function showPlannerMessage(message=''){
  $('plannerFeedback').textContent=message;
  $('plannerFeedback').hidden=!message;
}
function renderPlannerPeople(){
  const ids=plannerPeople[plannerMode], list=$('plannerPeople');
  list.replaceChildren();
  for(const [index,id] of ids.entries()){
    const person=document.createElement('span'),button=document.createElement('button'),dot=document.createElement('i'),remove=document.createElement('button');
    person.className='planner-person';
    person.classList.toggle('is-editing',index===plannerEditingIndex);
    button.type=remove.type='button';
    dot.style.background=plannerColor(index);dot.setAttribute('aria-hidden','true');
    remove.textContent='×';
    const name=STATIONS[id].name;
    button.setAttribute('aria-label',(index+1)+'人目の'+name+'を変更');
    remove.setAttribute('aria-label',(index+1)+'人目の'+name+'を外す');
    button.append(dot,name);
    button.onclick=()=>{
      clearPlannerSelection();plannerEditingIndex=index;plannerInput.value='';
      renderPlannerPeople();plannerInput.focus();
    };
    remove.onclick=()=>{plannerEditingIndex=null;ids.splice(index,1);invalidatePlanner();syncNomuRoom('remove',id);};
    person.append(button,remove);list.append(person);
  }
  $('plannerRun').disabled=ids.length<2;
  const number=plannerEditingIndex===null?ids.length+1:plannerEditingIndex+1;
  plannerInput.placeholder=number+'人目の'+(plannerMode==='living'?'職場の駅':'出発駅');
  plannerInput.setAttribute('aria-label',plannerInput.placeholder);
  $('plannerCancelEdit').hidden=plannerEditingIndex===null;
  $('plannerTools').dataset.complete=plannerMode==='living'&&ids.length>=2&&plannerEditingIndex===null;
  updatePlannerShare();
}
function invalidatePlanner(){
  clearPlannerSelection();
  plannerRevision++;
  plannerSearch=null;
  plannerCandidates=[];
  pickedPlannerId=plannerDecisionId=null;
  $('plannerResults').replaceChildren();
  $('plannerStatus').textContent='';
  $('plannerMeta').textContent=plannerPeople[plannerMode].length?'あと1人の駅を追加':'出発駅を選ぶ';
  showPlannerMessage('');
  setPlannerLoading(false);
  renderPlannerPeople();
  requestDraw();
  if(plannerPeople[plannerMode].length>=2)updatePlannerCandidates();
}
function clearPlannerSelection(){
  pendingPlannerId=null;
  $('plannerSelection').hidden=true;
  requestDraw();
}
function stagePlannerStation(id){
  if(!Number.isInteger(id)||!STATIONS[id])return;
  if(plannerMode==='living'&&plannerPeople.living.length>=2&&plannerEditingIndex===null){
    showPlannerMessage('変更する職場の駅をタップしてください。');
    return;
  }
  pendingPlannerId=id;
  $('plannerSelectionName').textContent=STATIONS[id].name;
  $('plannerSelectionArea').textContent=stationLabels[id]===STATIONS[id].name
    ?STATIONS[id].region??'':stationLabels[id];
  $('plannerSelection').hidden=false;
  $('plannerConfirmAdd').textContent=plannerEditingIndex===null?'追加する':'変更する';
  plannerInput.value='';
  plannerInput.setCustomValidity('');
  plannerInput.blur();
  showPlannerMessage('');
  requestDraw();
}
function addPlannerStation(id){
  const people=plannerPeople[plannerMode];
  if(plannerMode==='living'&&people.length>=2&&plannerEditingIndex===null){
    showPlannerMessage('変更する職場の駅をタップしてください。');
    return;
  }
  const replaced=plannerEditingIndex===null?null:people[plannerEditingIndex];
  if(plannerEditingIndex===null)people.push(id);
  else people[plannerEditingIndex]=id;
  plannerEditingIndex=null;
  clearPlannerSelection();
  plannerInput.value='';plannerInput.setCustomValidity('');plannerInput.blur();
  invalidatePlanner();
  $('plannerPeople').scrollLeft=$('plannerPeople').scrollWidth;
  if(replaced!==null&&replaced!==id)syncNomuRoom('remove',replaced).then(()=>syncNomuRoom('add',id));
  else syncNomuRoom('add',id);
}
$('plannerForm').onsubmit=event=>{
  event.preventDefault();
  const id=resolveStationInput(plannerInput.value);
  if(Number.isInteger(id))stagePlannerStation(id);
  else if(plannerInput.value.trim()){
    plannerInput.setCustomValidity('駅名を候補から選んでください。');plannerInput.reportValidity();
  }
};
plannerInput.oninput=()=>{clearPlannerSelection();plannerInput.setCustomValidity('');showPlannerMessage('');};
$('plannerConfirmAdd').onclick=()=>{
  if(pendingPlannerId!==null)addPlannerStation(pendingPlannerId);
};
function cancelPlannerSelection(){
  plannerEditingIndex=null;
  plannerInput.value='';
  clearPlannerSelection();
  renderPlannerPeople();
}
$('plannerCancelAdd').onclick=cancelPlannerSelection;
$('plannerCancelEdit').onclick=cancelPlannerSelection;
function loadHouseholdRents(){
  if(!householdRentPromise)householdRentPromise=fetch('household-rents.json?v=1').then(response=>{
    if(!response.ok)throw Error('家賃');return response.json();
  }).catch(error=>{householdRentPromise=null;throw error;});
  return householdRentPromise;
}
function layoutIndex(){return Number($('plannerLayout').value)-1;}
function layoutShort(){return layoutIndex()===0?'1LDK前後':'2LDK前後';}
function householdRecord(data,station){
  return station.region==='東京圏'||!station.region?data.records[station.name]?.[layoutIndex()]:null;
}
$('sumuLink').addEventListener('click', () => updateSumuLink(plannerPeople.living[0]));

for (const [id, order] of [['rankLongest', 'longest'], ['rankTotal', 'total']]) {
  $(id).onclick = () => {
    meetingOrder = order;
    $('rankLongest').setAttribute('aria-pressed', order === 'longest');
    $('rankTotal').setAttribute('aria-pressed', order === 'total');
    renderPlannerResults();
  };
}
for (const id of ['plannerBudget', 'plannerCap']) $(id).oninput = () => {
  if ($(id).validity.valid) renderPlannerResults();
};
$('plannerLayout').onchange=renderPlannerResults;
async function updatePlannerCandidates(){
  const living = plannerMode === 'living';
  const ids = [...plannerPeople[plannerMode]];
  if(ids.length<2)return;
  clearPlannerSelection();

  plannerInput.blur();
  const revision = ++plannerRevision;
  $('plannerStatus').textContent = '候補を計算中…';
  $('plannerMeta').textContent='候補を計算中…';
  $('plannerResults').replaceChildren();
  setPlannerLoading(true);
  try {
    const household=living?await loadHouseholdRents():null;
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (revision !== plannerRevision || planner.hidden) return;
    const journeys = ids.map(id => calculate(id, 'rail', express, false));
    plannerSearch = {living, ids, journeys, household};
    renderPlannerResults();
  } catch {
    if (revision === plannerRevision) {
      $('plannerStatus').textContent = '候補を表示できませんでした。もう一度お試しください。';
      $('plannerMeta').textContent='再計算してください';
    }
  } finally {
    if (revision === plannerRevision) {
      setPlannerLoading(false);
      $('plannerRun').hidden=!$('plannerStatus').textContent.includes('もう一度');
      renderPlannerPeople();
    }
  }
}
$('plannerRun').onclick=updatePlannerCandidates;
