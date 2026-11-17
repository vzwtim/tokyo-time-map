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

function plannerStationLabel(id) {
  return stationLabels[id] ?? STATIONS[id].name;
}

function openPlanner(kind, line = null) {
  plannerRevision++;
  plannerSearch = null;
  plannerMode = kind;
  plannerLine = line;
  const living = kind === 'living';
  $('plannerTitle').textContent = living ? '住む駅' : '飲む駅';
  $('plannerScope').textContent = line || '';
  $('plannerScope').hidden = !line;
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
  $('plannerNote').textContent = living ? '単身向け家賃・通勤時間は概算' : '所要時間は概算・新幹線を除く';
  updateTimeValue();
  planner.hidden = false;
}

function updateTimeValue() {
  $('timeValueLabel').textContent = yen.format($('timeValue').valueAsNumber) + '円';
}

function closePlanner() {
  plannerRevision++;
  planner.hidden = true;
}

function renderPlannerResults() {
  if (!plannerSearch) return;
  const {living, ids, journeys, allowed} = plannerSearch;
  const rows = living
    ? rankLivingStations(STATIONS, journeys[0].best, rentLayer.observed, $('timeValue').valueAsNumber, $('commuteDays').valueAsNumber, allowed)
    : rankMeetingStations(STATIONS, journeys);
  const candidates = [];
  for (const row of rows) {
    const duplicate = candidates.some(({station}) =>
      station.name === row.station.name && station.region === row.station.region && distance(station,row.station)<.75);
    if (!duplicate) candidates.push(row);
    if (candidates.length === 8) break;
  }
  const list = $('plannerResults');
  list.replaceChildren();
  $('plannerStatus').textContent = rows.length
    ? (living ? '月の負担が小さい順' : '最も遠い人の所要時間が短い順') + ' · 上位' + candidates.length + '駅'
    : (living ? '比較できる家賃相場がありません。職場の駅や沿線を変えてください。' : '全員が鉄道で行ける駅が見つかりませんでした。');
  for (const [index, row] of candidates.entries()) {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    const detail = document.createElement('small');
    const amount = document.createElement('span');
    const sameName = byName.get(row.station.name);
    const nearbyDuplicates = sameName?.every(station => station.region === row.station.region && distance(station,row.station)<.75);
    name.textContent = (index + 1) + '　' + (nearbyDuplicates ? row.station.name : plannerStationLabel(row.station.id));
    detail.textContent = living
      ? '家賃 ' + yen.format(row.rent) + '円 ＋ 時間換算 ' + yen.format(row.timeCost) + '円 · 片道約' + Math.round(row.minutes) + '分'
      : row.minutes.map((minutes, i) => STATIONS[ids[i]].name + 'から ' + Math.round(minutes) + '分').join(' / ');
    amount.textContent = living ? yen.format(row.total) + '円／月' : '最長 ' + Math.round(row.longest) + '分';
    li.append(name, amount, detail);
    list.append(li);
  }
}

$('sumuLink').addEventListener('click', () => updateSumuLink(resolveStationInput(plannerInputs[0].value)));
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
  input.setCustomValidity('');
  $('plannerResults').replaceChildren();
  $('plannerStatus').textContent = '';
  $('plannerRun').disabled = false;
};
// Keep a visible suggestion list in place until the submit button receives the click.
$('plannerRun').addEventListener('pointerdown', event => {
  const focused = document.activeElement;
  if (plannerInputs.includes(focused) && focused.getAttribute('aria-expanded') === 'true') event.preventDefault();
});
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

  if (plannerInputs.includes(document.activeElement)) document.activeElement.blur();
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
  } catch {
    if (revision === plannerRevision) $('plannerStatus').textContent = '候補を表示できませんでした。もう一度お試しください。';
  } finally {
    if (revision === plannerRevision) {
      $('plannerRun').disabled = false;
    }
  }
};
