'use strict';

const planner = $('stationPlanner');
const plannerInputs = ['plannerFirst', 'plannerSecond', 'plannerThird'].map($);
const yen = new Intl.NumberFormat('ja-JP');
let plannerMode = 'living', plannerSearch = null, plannerRevision = 0;
let meetingOrder = 'longest';
let plannerCandidates = [], pickedPlannerId = null;
const setPlannerSheetLevel = bindMapSheet(planner, $('plannerSheetHandle'), $('plannerSheetBody'), requestDraw);
setPlannerSheetLevel(0);

function rankPlannerStations(stations, journeys, {rents, cap, budget, order}) {
  return stations.flatMap(station => {
    const minutes = journeys.map(journey => journey.best[station.id].time);
    if (!minutes.every(Number.isFinite)) return [];
    const longest = Math.max(...minutes);
    const rent = rents?.[station.id]?.rent;
    if (rents && (!rent || rent > budget || longest > cap)) return [];
    const total = minutes.reduce((sum, time) => sum + time, 0);
    return [{station, minutes, longest, total, rent}];
  }).sort((a, b) => (order === 'total' ? a.total - b.total || a.longest - b.longest : a.longest - b.longest || a.total - b.total)
    || (a.rent || 0) - (b.rent || 0) || a.station.id - b.station.id);
}

function setPlannerLoading(loading) {
  $('plannerLoading').hidden = !loading;
  $('plannerRun').disabled = loading;
  $('plannerRun').textContent = loading ? '計算中…' : '候補を探す';
}

function openPlanner(kind) {
  plannerRevision++;
  plannerSearch = null;
  plannerMode = kind;
  const living = kind === 'living';
  planner.dataset.mode = kind;
  $('plannerTitle').textContent = living ? '住む駅' : '飲む駅';
  $('plannerMeta').textContent = '条件を入力';
  $('plannerConditions').open = true;
  plannerCandidates = [];
  pickedPlannerId = null;
  $('plannerFirstLabel').textContent = living ? '1人目の職場' : '1人目の出発駅';
  $('plannerSecondLabel').textContent = living ? '2人目の職場' : '2人目の出発駅';
  $('plannerThirdRow').hidden = living;
  $('livingControls').hidden = !living;
  $('meetingControls').hidden = living;
  for (const id of ['plannerBudget', 'plannerCap']) $(id).disabled = !living;
  plannerInputs[0].value = stationLabels[origin] ?? STATIONS[origin].name;
  plannerInputs[1].value = '';
  plannerInputs[2].value = '';
  plannerInputs.forEach(input => input.setCustomValidity(''));
  $('plannerStatus').textContent = '';
  $('plannerResults').replaceChildren();
  $('sumuLink').hidden = !living;
  $('plannerNote').textContent = living ? '東京圏の単身向け相場を使用 · 通勤時間は反対方向の経路を使った概算' : '所要時間は概算 · 新幹線を除く';
  setPlannerLoading(false);
  planner.hidden = false;
  setPlannerSheetLevel(1);
}

function closePlanner() {
  plannerRevision++;
  planner.hidden = true;
}

function renderPlannerResults() {
  if (!plannerSearch) return;
  const {living, ids, journeys} = plannerSearch;
  const order = living ? 'longest' : meetingOrder;
  const rows = rankPlannerStations(STATIONS, journeys, {
    rents: living ? rentLayer.observed : null,
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
  $('plannerMeta').textContent = candidates.length ? '候補 '+candidates.length+'駅' : '条件を調整';
  list.replaceChildren();
  $('plannerStatus').textContent = rows.length
    ? (order === 'total' ? '合計が短い順' : '最長が短い順') + ' · ' + candidates.length + '駅'
    : (living ? '条件に合う家賃データがありません。家賃か片道の上限を調整してください。' : '全員が鉄道で行ける駅が見つかりませんでした。');
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
    other.textContent = living ? '駅相場 '+yen.format(rent)+'円／月'
      : (order === 'total' ? '最長 '+Math.round(longest)+'分' : '合計 '+Math.round(total)+'分');
    button.type = 'button';
    button.dataset.candidate = station.id;
    button.setAttribute('aria-pressed',station.id===pickedPlannerId);
    button.append(name,amount,detail,other);
    button.onclick = () => selectPlannerCandidate(station.id,true);
    li.append(button);
    list.append(li);
  }
  requestDraw();
}

function selectPlannerCandidate(id,center=false) {
  pickedPlannerId = id;
  for (const b of $('plannerResults').querySelectorAll('button')) {
    b.setAttribute('aria-pressed',Number(b.dataset.candidate)===id);
  }
  const row=plannerCandidates.find(entry=>entry.station.id===id);
  if(row)$('plannerMeta').textContent = row.station.name;
  if(center)centerAtlasPoint(points[stationIndex[id]].geo);
  else requestDraw();
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
function drawPlannerMap(project) {
  if (!plannerSearch) return;
  const {ids, journeys, living} = plannerSearch;
  const color=living?'#2c745d':'#a56b25';
  const originColors=['#456e8d','#945970','#657b40'];
  if(pickedPlannerId!==null){
    for(const [i,journey] of journeys.entries()){
      const steps=journey.route(pickedPlannerId);
      ctx.beginPath();ctx.strokeStyle=originColors[i];ctx.lineWidth=2.1;ctx.globalAlpha=.75;
      for(const step of steps){
        ctx.moveTo(...project(points[stationIndex[step.from]].geo));
        ctx.lineTo(...project(points[stationIndex[step.to]].geo));
      }
      ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  for(const [index,{station}] of plannerCandidates.entries()){
    const point=project(points[stationIndex[station.id]].geo);
    atlasDot(point,{label:(index+1)+' '+station.name,color,radius:station.id===pickedPlannerId?6:4,
      priority:station.id===pickedPlannerId,action:()=>selectPlannerCandidate(station.id)});
  }
  for(const [i,id] of ids.entries()){
    atlasDot(project(points[stationIndex[id]].geo),{label:STATIONS[id].name,color:originColors[i],radius:4.1});
  }
}

$('sumuLink').addEventListener('click', () => updateSumuLink(resolveStationInput(plannerInputs[0].value)));
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
for (const input of plannerInputs) input.oninput = () => {
  plannerRevision++;
  plannerSearch = null;
  input.setCustomValidity('');
  $('plannerResults').replaceChildren();
  $('plannerStatus').textContent = '';
  $('plannerMeta').textContent = '条件を入力';
  plannerCandidates=[];
  pickedPlannerId=null;
  requestDraw();
  setPlannerLoading(false);
};
$('plannerRun').addEventListener('pointerdown', event => {
  const focused = document.activeElement;
  if (plannerInputs.includes(focused) && focused.getAttribute('aria-expanded') === 'true') event.preventDefault();
});
$('plannerForm').onsubmit = async event => {
  event.preventDefault();
  const living = plannerMode === 'living';
  const inputs = plannerInputs.filter((input, i) => i < 2 || (!living && input.value.trim()));
  const ids = [];
  for (const input of inputs) {
    const id = resolveStationInput(input.value);
    if (!Number.isInteger(id)) {
      input.setCustomValidity('駅名を入力し、候補から選んでください。');
      input.reportValidity();
      return;
    }
    ids.push(id);
  }

  if (plannerInputs.includes(document.activeElement)) document.activeElement.blur();
  const revision = ++plannerRevision;
  $('plannerStatus').textContent = '候補を計算中…';
  $('plannerResults').replaceChildren();
  setPlannerLoading(true);
  try {
    if (living) await loadRent();
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (revision !== plannerRevision || planner.hidden) return;
    const journeys = ids.map(id => calculate(id, 'rail', express, false));
    plannerSearch = {living, ids, journeys};
    renderPlannerResults();
    if(plannerCandidates.length){
      $('plannerConditions').open=false;
      $('plannerSheetBody').scrollTop=0;
      focusPlannerResults();
    }
  } catch {
    if (revision === plannerRevision) $('plannerStatus').textContent = '候補を表示できませんでした。もう一度お試しください。';
  } finally {
    if (revision === plannerRevision) setPlannerLoading(false);
  }
};
