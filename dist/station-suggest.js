'use strict';

const suggestionLimit = 6;
const normalizeStationQuery = text => text.normalize('NFKC').toLowerCase()
  .replace(/[ヶヵ]/g, 'ケ')
  .replace(/[ァ-ヶ]/g, letter => String.fromCharCode(letter.charCodeAt(0)-0x60));

const stationSearchRecords = STATIONS.map(station => ({
  station,
  value: stationLabels[station.id],
  name: normalizeStationQuery(station.name),
  label: normalizeStationQuery(stationLabels[station.id]),
}));

function findStationSuggestions(query) {
  const key = normalizeStationQuery(query.trim());
  if (!key) return [];
  const matches = [];
  for (const record of stationSearchRecords) {
    const {name, label, station} = record;
    const score = name === key || label === key ? 0
      : name.startsWith(key) ? 1
      : label.startsWith(key) ? 2
      : name.includes(key) ? 3 : 4;
    if (score < 4) matches.push({record, score, main: S[station.name] === station.id});
  }
  matches.sort((a,b) => a.score-b.score || Number(b.main)-Number(a.main) || a.record.station.id-b.record.station.id);

  const results = [];
  for (const {record} of matches) {
    const duplicate = results.some(({station}) => station.name === record.station.name &&
      station.region === record.station.region && distance(station, record.station) < .75);
    if (duplicate && record.label !== key) continue;
    results.push(record);
    if (results.length === suggestionLimit) break;
  }
  return results;
}

function attachSuggestions(input, onChoose) {
  const list = document.createElement('ul');
  list.className = 'station-suggestions';
  list.id = input.id + '-suggestions';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', '駅名の候補');
  list.hidden = true;
  input.after(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');
  let matches = [];
  let active = -1;
  let composing = false;
  let choosing = false;

  function close() {
    list.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function choose(index) {
    const match = matches[index];
    input.value = match.value;
    choosing = true;
    input.dispatchEvent(new Event('input', {bubbles:true}));
    choosing = false;
    close();
    onChoose?.(match.station.id);
  }

  function refresh() {
    close();
    matches = findStationSuggestions(input.value);
    list.replaceChildren();
    for (const [index, match] of matches.entries()) {
      const option = document.createElement('li');
      option.id = list.id + '-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const name = document.createElement('span');
      name.textContent = match.station.name;
      const area = document.createElement('small');
      area.textContent = match.value === match.station.name ? match.station.region : match.value.slice(match.station.name.length+1,-1);
      option.append(name, area);
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => choose(index));
      list.append(option);
    }
    if (!matches.length) return;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('compositionstart', () => { composing = true; close(); });
  input.addEventListener('compositionend', () => { composing = false; refresh(); });
  input.addEventListener('input', event => {
    if (!choosing && !event.isComposing && !composing) refresh();
  });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', event => {
    if (composing || event.isComposing || list.hidden) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Enter' && (active >= 0 || onChoose)) {
      event.preventDefault();
      choose(Math.max(0, active));
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (active === -1) active = event.key === 'ArrowDown' ? 0 : matches.length-1;
    else active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    for (const [index, option] of [...list.children].entries()) option.setAttribute('aria-selected', index === active);
    const option = list.children[active];
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({block:'nearest'});
  });
}

attachSuggestions($('stationInput'));
attachSuggestions($('plannerInput'), addPlannerStation);
