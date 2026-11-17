'use strict';

const roadMap = $('oldRoadMap');
const setRoadSheetLevel = bindMapSheet($('roadDock'), $('roadSheetHandle'), $('roadSheetBody'), () => {});
const roadQuery = $('roadQuery');
const roadSuggestions = $('roadSuggestions');
const roadColors = ['#a64e35', '#4f527f', '#3c7861', '#975e24', '#297081'];
const roadNamespace = 'http://www.w3.org/2000/svg';
let oldRoadData, oldRoadRequest, activeRoad, activeStop = null;
const roadPointers = new Map();
let roadMoved = false;
let roadCamera = {x: 0, y: 0, scale: 1}, roadFitScale = 1;
let roadWorld, roadStopLayer, roadMarkers = [];

const roadPoint = ([lon, lat]) => [(lon - 139) * .81, 37 - lat];
const roadPath = parts => parts.map(part =>
  part.map((coord, index) => {
    const [x, y] = roadPoint(coord);
    return (index ? 'L' : 'M') + x.toFixed(5) + ',' + y.toFixed(5);
  }).join('')
).join('');

function roadNode(tag, attrs, label) {
  const node = document.createElementNS(roadNamespace, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (label) node.textContent = label;
  return node;
}

function loadOldRoads() {
  if (oldRoadData) {
    if (!activeRoad) pickRoad(oldRoadData.roads[0]);
    else drawRoadCamera();
    return;
  }
  if (oldRoadRequest) return;
  $('roadStatus').textContent = '街道を読み込み中…';
  $('roadLoading').hidden = false;
  oldRoadRequest = fetch('old-roads.json?v=1').then(response => {
    if (!response.ok) throw Error('roads');
    return response.json();
  }).then(data => {
    oldRoadData = data;
    $('roadStatus').textContent = '';
    for (const [index, road] of data.roads.entries()) {
      road.color = roadColors[index];
      const button = document.createElement('button');
      const dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      button.type = 'button';
      button.append(dot, road.name);
      button.style.setProperty('--road-color', road.color);
      button.onclick = () => pickRoad(road);
      road.button = button;
      $('roadChips').append(button);
    }
    if (!$('roadsView').hidden) pickRoad(data.roads[0]);
  }).catch(() => {
    $('roadStatus').textContent = '街道を読み込めませんでした。地図を開き直してください。';
    setRoadSheetLevel(1);
  }).finally(() => { oldRoadRequest = null; $('roadLoading').hidden = true; });
}

function pickRoad(road) {
  activeRoad = road;
  activeStop = null;
  $('roadsTitle').textContent = road.name;
  $('roadTerminals').textContent = road.stops[0].name + ' → ' + road.stops.at(-1).name;
  $('roadStops').style.setProperty('--road-color', road.color);
  for (const other of oldRoadData.roads) other.button.setAttribute('aria-pressed', other === road);

  const stops = document.createDocumentFragment();
  for (const [index, stop] of road.stops.entries()) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const number = document.createElement('small');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    number.textContent = /^\d+$/.test(stop.serial) ? stop.serial : '';
    button.append(document.createElement('i'), stop.name, number);
    button.onclick = () => chooseRoadStop(index);
    item.append(button);
    stops.append(item);
  }
  $('roadStops').replaceChildren(stops);
  $('roadSheetBody').scrollTop = 0;

  roadWorld = roadNode('g', {});
  roadWorld.append(roadNode('path', {class: 'old-coast', 'fill-rule': 'evenodd', d: oldRoadData.coast}));
  for (const other of [...oldRoadData.roads.filter(entry => entry !== road), road]) {
    const features = roadNode('g', {color: other.color, class: other === road ? 'active-route' : 'other-routes'});
    if (other === road) features.append(roadNode('path', {class: 'old-route-casing', d: roadPath(other.lines)}));
    features.append(roadNode('path', {class: 'old-route', d: roadPath(other.lines)}));
    roadWorld.append(features);
  }

  // The ordered stop list is the keyboard-accessible equivalent of the map markers.
  roadStopLayer = roadNode('g', {color: road.color, 'aria-hidden': 'true'});
  roadMarkers = road.stops.map((stop, index) => {
    const marker = roadNode('g', {class: 'old-stop', 'aria-pressed': 'false'});
    const label = roadNode('text', {x: 8, y: -7}, stop.name);
    marker.append(roadNode('circle', {r: 12, class: 'stop-hit'}), roadNode('circle', {r: 3.7}), label);
    marker.append(roadNode('title', {}, stop.name + ' ・ ' + stop.region));
    marker.onclick = () => chooseRoadStop(index, true);
    roadStopLayer.append(marker);
    return {point: roadPoint(stop.point), marker, label, width: stop.name.length * 12 + 7};
  });
  roadMap.replaceChildren(roadWorld, roadStopLayer);
  fitOldRoad();
}

function fitOldRoad() {
  if (!activeRoad || !roadMap.clientWidth || !roadMap.clientHeight) return;
  const points = activeRoad.lines.flat().map(roadPoint).concat(roadMarkers.map(marker => marker.point));
  const x = points.map(p => p[0]), y = points.map(p => p[1]);
  const left = Math.min(...x), right = Math.max(...x), top = Math.min(...y), bottom = Math.max(...y);
  roadFitScale = Math.min(
    Math.max(80, roadMap.clientWidth - 70) / Math.max(.06, right - left),
    Math.max(80, roadMap.clientHeight - 214) / Math.max(.06, bottom - top)
  );
  roadCamera = {x: (left + right) / 2, y: (top + bottom) / 2, scale: roadFitScale};
  drawRoadCamera();
}

function drawRoadCamera() {
  if (!roadWorld) return;
  const {clientWidth: width, clientHeight: height} = roadMap;
  if (!width || !height) return;
  const {x, y, scale} = roadCamera;
  roadMap.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const dx = width / 2 - x * scale, dy = (height + 25) / 2 - y * scale;
  roadWorld.setAttribute('transform', `translate(${dx} ${dy}) scale(${scale})`);

  const positions = roadMarkers.map(({point, marker}) => {
    const mx = point[0] * scale + dx, my = point[1] * scale + dy;
    marker.setAttribute('transform', `translate(${mx} ${my})`);
    return [mx, my];
  });
  const last = roadMarkers.length - 1;
  const priority = new Set([activeStop, 0, last, ...roadMarkers.keys()]);
  const placed = [];
  for (const i of priority) {
    if (i === null) continue;
    const {label, width: nameWidth} = roadMarkers[i];
    const [x, y] = positions[i];
    const left = x + nameWidth + 12 > width;
    const below = y < 24;
    label.setAttribute('x', left ? -8 : 8);
    label.setAttribute('y', below ? 16 : -7);
    label.setAttribute('text-anchor', left ? 'end' : 'start');
    const box = [left ? x - nameWidth - 8 : x + 8, below ? y + 4 : y - 20, nameWidth, 16];
    const visible = x >= 0 && x <= width && y >= 0 && y <= height;
    const overlap = placed.some(([bx, by, bw, bh]) =>
      bx < box[0] + box[2] + 4 && bx + bw + 4 > box[0] && by < box[1] + box[3] + 4 && by + bh + 4 > box[1]);
    label.style.display = visible && (i === activeStop || !overlap) ? '' : 'none';
    if (label.style.display !== 'none') placed.push(box);
  }
}

function chooseRoadStop(index, fromMap = false) {
  activeStop = index;
  const stop = activeRoad.stops[index];
  $('roadsTitle').textContent = stop.name;
  $('roadTerminals').textContent = activeRoad.name+' · '+stop.region;
  const items = $('roadStops').children;
  for (const [i, {marker}] of roadMarkers.entries()) {
    marker.setAttribute('aria-pressed', i === index);
    items[i].firstElementChild.setAttribute('aria-pressed', i === index);
  }
  if (fromMap) {
    const list = $('roadSheetBody');
    list.scrollTop = items[index].offsetTop - items[0].offsetTop;
  } else {
    const [x, y] = roadMarkers[index].point;
    roadCamera = {...roadCamera, x, y};
  }
  drawRoadCamera();
}

function zoomOldRoad(factor, x = roadMap.clientWidth / 2, y = roadMap.clientHeight / 2) {
  if (!activeRoad) return;
  const {scale} = roadCamera;
  const next = Math.max(roadFitScale / 2.5, Math.min(3500, scale * factor));
  roadCamera.x += (x - roadMap.clientWidth / 2) * (1 / scale - 1 / next);
  roadCamera.y += (y - (roadMap.clientHeight + 25) / 2) * (1 / scale - 1 / next);
  roadCamera.scale = next;
  drawRoadCamera();
}

$('roadZoomIn').onclick = () => zoomOldRoad(1.45);
$('roadZoomOut').onclick = () => zoomOldRoad(1 / 1.45);
$('roadFit').onclick = fitOldRoad;
roadMap.addEventListener('wheel', event => {
  if (!activeRoad) return;
  event.preventDefault();
  const rect = roadMap.getBoundingClientRect();
  zoomOldRoad(Math.exp(-Math.max(-240, Math.min(240, event.deltaY)) * .002), event.clientX - rect.left, event.clientY - rect.top);
}, {passive:false});
roadMap.addEventListener('keydown', event => {
  const delta = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
  if (delta) {
    roadCamera.x += delta[0] * 65 / roadCamera.scale;
    roadCamera.y += delta[1] * 65 / roadCamera.scale;
    drawRoadCamera();
  } else if (event.key === '+' || event.key === '=') zoomOldRoad(1.45);
  else if (event.key === '-') zoomOldRoad(1 / 1.45);
  else return;
  event.preventDefault();
});
roadMap.addEventListener('pointerdown', event => {
  if (!activeRoad || event.button !== 0 || roadPointers.size >= 2) return;
  if (!roadPointers.size) roadMoved = false;
  roadPointers.set(event.pointerId, [event.clientX, event.clientY]);
  if (roadPointers.size === 2) {
    roadMoved = true;
    for (const id of roadPointers.keys()) roadMap.setPointerCapture(id);
  }
});
roadMap.addEventListener('pointermove', event => {
  const old = roadPointers.get(event.pointerId);
  if (!old) return;
  const x = event.clientX, y = event.clientY, dx = x - old[0], dy = y - old[1];
  if (!roadMoved) {
    if (Math.hypot(dx, dy) < 5) return;
    roadMoved = true;
    roadMap.setPointerCapture(event.pointerId);
  }
  roadPointers.set(event.pointerId, [x, y]);
  if (roadPointers.size === 2) {
    const [ox, oy] = [...roadPointers.entries()].find(([id]) => id !== event.pointerId)[1];
    const bounds = roadMap.getBoundingClientRect();
    roadCamera.x -= dx / (2 * roadCamera.scale);
    roadCamera.y -= dy / (2 * roadCamera.scale);
    zoomOldRoad(Math.hypot(x - ox, y - oy) / Math.max(1, Math.hypot(old[0] - ox, old[1] - oy)),
      (x + ox) / 2 - bounds.left, (y + oy) / 2 - bounds.top);
    return;
  }
  roadCamera.x -= dx / roadCamera.scale;
  roadCamera.y -= dy / roadCamera.scale;
  drawRoadCamera();
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) {
  roadMap.addEventListener(event, e => roadPointers.delete(e.pointerId));
}
function findRoadStops(query) {
  return (oldRoadData?.roads ?? []).flatMap(road => road.stops.flatMap((stop,index) =>
    stop.name.includes(query) ? [{road,stop,index}] : [])).slice(0,6);
}

function selectRoadSuggestion({road,stop,index}) {
  if (road !== activeRoad) pickRoad(road);
  roadQuery.value = stop.name;
  roadSuggestions.hidden = true;
  roadQuery.blur();
  chooseRoadStop(index);
}

roadQuery.addEventListener('input', () => {
  const query = roadQuery.value.trim();
  const matches = query ? findRoadStops(query) : [];
  roadSuggestions.replaceChildren();
  for (const match of matches) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const road = document.createElement('small');
    button.type = 'button';
    button.textContent = match.stop.name;
    road.textContent = match.road.name;
    button.append(road);
    button.onclick = () => selectRoadSuggestion(match);
    li.append(button);
    roadSuggestions.append(li);
  }
  roadSuggestions.hidden = !matches.length;
});
roadQuery.addEventListener('keydown', event => {
  if (event.key === 'Escape') roadSuggestions.hidden = true;
  if (event.key === 'Enter' && !roadSuggestions.hidden) {
    event.preventDefault();
    roadSuggestions.querySelector('button')?.click();
  }
});
$('roadsView').addEventListener('pointerdown', event => {
  if (!event.target.closest('.road-search')) roadSuggestions.hidden = true;
});
new ResizeObserver(drawRoadCamera).observe(roadMap);

