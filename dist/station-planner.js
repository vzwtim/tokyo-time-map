'use strict';

function rankLivingStations(stations, times, rents, hourlyValue, days, allowed) {
  return stations.flatMap(station => {
    const minutes = times[station.id].time;
    const rent = rents[station.id]?.rent;
    if (!rent || !Number.isFinite(minutes) || (allowed && !allowed.has(station.id))) return [];
    const timeCost = Math.round(minutes * 2 * days * hourlyValue / 60);
    return [{station, minutes, rent, timeCost, total: rent + timeCost}];
  }).sort((a, b) => a.total - b.total || a.minutes - b.minutes || a.station.id - b.station.id);
}

function rankMeetingStations(stations, journeys) {
  return stations.flatMap(station => {
    const minutes = journeys.map(journey => journey.best[station.id].time);
    if (!minutes.every(Number.isFinite)) return [];
    return [{station, minutes, longest: Math.max(...minutes), total: minutes.reduce((a, b) => a + b, 0)}];
  }).sort((a, b) => a.longest - b.longest || a.total - b.total || a.station.id - b.station.id);
}

const planner = $('stationPlanner');
const plannerInputs = ['plannerFirst', 'plannerSecond', 'plannerThird'].map($);
const yen = new Intl.NumberFormat('ja-JP');
let plannerMode = 'living', plannerSearch = null, plannerRevision = 0, plannerLine = null;
let plannerMarkers = [];
let plannerFocusId = null;

function plannerStationLabel(id) {
  return stationLabels[id] ?? STATIONS[id].name;
}

function openPlanner(kind, line = null) {
  plannerRevision++;
  plannerSearch = null;
  plannerMarkers = [];
  plannerFocusId = null;
  $('plannerIntro').hidden = false;
  plannerMode = kind;
  plannerLine = line;
  const living = kind === 'living';
  $('plannerTitle').textContent = living ? '住む駅' : '飲む駅';
  $('plannerIntro').textContent = living
    ? (line ? line + 'の家賃と通勤時間を比べる' : '家賃と通勤時間から、暮らす駅を探す')
    : '出発駅を入れて、みんなが集まりやすい駅を探す';
  $('plannerFirstLabel').textContent = living ? '職場の駅' : '1人目の出発駅';
  $('plannerSecondRow').hidden = living;
  $('plannerThirdRow').hidden = living;
  $('livingControls').hidden = !living;
  $('sumuLink').hidden = !living;
  plannerInputs[0].value = plannerStationLabel(origin);
  plannerInputs[1].value = '';
  plannerInputs[2].value = '';
  plannerInputs.forEach(input => input.setCustomValidity(''));
  plannerInputs[1].required = !living;
  $('plannerStatus').textContent = '';
  $('plannerRun').disabled = false;
  $('plannerResults').replaceChildren();
  $('plannerNote').textContent = living
    ? '通勤時間は職場の駅を起点にした片道の概算。家賃は東京圏の単身向け相場（2026年10月取得、面積・築年数未補正）。'
    : '所要時間は駅から駅までの概算（新幹線を除く）。終電やお店の営業時間は別途ご確認ください。';
  updateTimeValue();
  planner.hidden = false;
  $('explorePanel').hidden = true;
  dismissDestination();
  setLayer(false);
  set3D(false);
  if (mix < .98) changeMix(1, true);
  syncLayerModes();
  setSheetLevel(1);
  sheetHandle.focus({preventScroll:true});
}

function updateTimeValue() {
  $('timeValueLabel').textContent = yen.format($('timeValue').valueAsNumber) + '円';
}

function closePlanner() {
  plannerRevision++;
  plannerSearch = null;
  plannerMarkers = [];
  planner.hidden = true;
  $('explorePanel').hidden = false;
  dismissDestination();
}

function focusPlannerStation(id) {
  const point = points[stationIndex[id]].target;
  wheelZoom = null;
  overviewMode = null;
  animation = null;
  zoom = 1;
  const visibleHeight = Math.max(120, H - $('rentDock').offsetHeight);
  pan = [-point[0] * 17, visibleHeight * .52 - H / 2 - point[1] * 17];
  requestDraw();
}

function drawPlannerMarkers() {
  if (planner.hidden) return;
  const color = plannerMode === 'living' ? '#1c7164' : '#6755a5';
  ctx.save();
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = plannerMarkers.length - 1; i >= 0; i--) {
    const id = plannerMarkers[i].station.id;
    if (i>=3 && id!==plannerFocusId) continue;
    const point = lastScreen[stationIndex[id]];
    if (!point || point[0]<0 || point[0]>W || point[1]<0 || point[1]>H) continue;
    ctx.beginPath();
    ctx.arc(point[0], point[1], id===plannerFocusId || !i ? 13 : 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(String(i + 1), point[0], point[1] + .5);
  }
  ctx.restore();
}

function renderPlannerResults() {
  if (!plannerSearch) return;
  const {living, ids, journeys, allowed} = plannerSearch;
  const rows = living
    ? rankLivingStations(STATIONS, journeys[0].best, rentLayer.observed, $('timeValue').valueAsNumber, $('commuteDays').valueAsNumber, allowed)
    : rankMeetingStations(STATIONS, journeys);
  plannerMarkers = [];
  for (const row of rows) {
    const duplicate = plannerMarkers.some(({station}) =>
      station.name === row.station.name && station.region === row.station.region && distance(station,row.station)<.75);
    if (!duplicate) plannerMarkers.push(row);
    if (plannerMarkers.length === 8) break;
  }
  if (!plannerMarkers.some(row => row.station.id === plannerFocusId)) plannerFocusId = null;
  $('plannerIntro').hidden = rows.length > 0;
  const list = $('plannerResults');
  list.replaceChildren();
  $('plannerStatus').textContent = rows.length
    ? (living ? '月の負担が小さい順' : '最も遠い人の所要時間が短い順') + ' · 上位' + plannerMarkers.length + '駅'
    : (living ? '比較できる家賃相場がありません。職場の駅や沿線を変えてください。' : '全員が鉄道で行ける駅が見つかりませんでした。');
  for (const [index, row] of plannerMarkers.entries()) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const name = document.createElement('strong');
    const detail = document.createElement('small');
    const amount = document.createElement('span');
    button.type = 'button';
    const sameName = byName.get(row.station.name);
    const nearbyDuplicates = sameName?.every(station => station.region === row.station.region && distance(station,row.station)<.75);
    name.textContent = (index + 1) + '　' + (nearbyDuplicates ? row.station.name : plannerStationLabel(row.station.id));
    detail.textContent = living
      ? '家賃 ' + yen.format(row.rent) + '円 ＋ 通勤 ' + yen.format(row.timeCost) + '円 · 片道約' + Math.round(row.minutes) + '分'
      : row.minutes.map((minutes, i) => STATIONS[ids[i]].name + 'から ' + Math.round(minutes) + '分').join(' / ');
    amount.textContent = living ? yen.format(row.total) + '円／月' : '最長 ' + Math.round(row.longest) + '分';
    button.append(name, amount, detail);
    if (row.station.id === plannerFocusId) button.setAttribute('aria-current', 'true');
    button.onclick = () => {
      plannerFocusId = row.station.id;
      focusPlannerStation(row.station.id);
      list.querySelector('[aria-current]')?.removeAttribute('aria-current');
      button.setAttribute('aria-current', 'true');
    };
    li.append(button);
    list.append(li);
  }
  updateSheetSummary();
  requestDraw();
}

$('livingOpen').onclick = () => openPlanner('living');
$('meetingOpen').onclick = () => openPlanner('meeting');
$('timeValue').oninput = () => {
  updateTimeValue();
  if ($('commuteDays').validity.valid) renderPlannerResults();
};
$('commuteDays').oninput = () => {
  if ($('commuteDays').validity.valid) renderPlannerResults();
};
for (const input of plannerInputs) input.oninput = () => {
  plannerRevision++;
  plannerSearch = null;
  plannerMarkers = [];
  plannerFocusId = null;
  input.setCustomValidity('');
  $('plannerResults').replaceChildren();
  $('plannerStatus').textContent = '';
  $('plannerRun').disabled = false;
  updateSheetSummary();
  requestDraw();
};
$('plannerForm').onsubmit = async event => {
  event.preventDefault();
  const living = plannerMode === 'living';
  const inputs = living ? plannerInputs.slice(0, 1) : plannerInputs.filter((input, i) => i < 2 || input.value.trim());
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

  const revision = ++plannerRevision;
  $('plannerStatus').textContent = '候補を計算中…';
  $('plannerRun').disabled = true;
  try {
    if (living) await loadRent();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (revision !== plannerRevision || planner.hidden) return;
    const journeys = ids.map(id => calculate(id, 'rail', express, living && shinkansen));
    const allowed = living && plannerLine
      ? new Set(rentLayer.profile(plannerLine).map(row => row.id)) : null;
    plannerSearch = {living, ids, journeys, allowed};
    renderPlannerResults();
    if (plannerMarkers.length) {
      $('plannerResults').scrollIntoView({block:'start',inline:'nearest'});
      selectOrigin(ids[0]);
      focusPlannerStation(plannerMarkers[0].station.id);
    }
  } catch {
    if (revision === plannerRevision) $('plannerStatus').textContent = '候補を表示できませんでした。もう一度お試しください。';
  } finally {
    if (revision === plannerRevision) {
      $('plannerRun').disabled = false;
      updateSheetSummary();
    }
  }
};
