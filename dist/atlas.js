'use strict';

const atlasPicker = $('atlasPicker');
const mapOptions = $('mapOptions');
const atlasChoices = [...atlasPicker.querySelectorAll('[data-atlas-view]')];
const atlasViews = new Set(atlasChoices.map(choice => choice.dataset.atlasView));
let cameraShift = [0, 0];
let geographicPaths;
let atlasHits = [], atlasLabels = [];

for (const dialog of [atlasPicker, mapOptions, $('rentHourlyDialog')]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
$('mapMenuOpen').onclick = () => atlasPicker.showModal();
$('mapSettingsOpen').onclick = () => mapOptions.showModal();
$('aboutBtn').addEventListener('click', closeMapMenu, {capture:true});

function retainAtlasCamera(from, to) {
  const camera = currentPan();
  wheelZoom = null;
  overviewMode = null;
  animation = null;
  quickTap = null;
  if (from === 'rail') {
    let nearest;
    let nearestDistance = Infinity;
    const scale = 17 * zoom;
    for (const id of stationIndex) {
      const point = points[id];
      const gap = (point.target[0] + camera[0] / scale) ** 2 + (point.target[1] + camera[1] / scale) ** 2;
      if (gap < nearestDistance) { nearest = point; nearestDistance = gap; }
    }
    cameraShift = nearest ? nearest.target.map((value, axis) => value - (nearest.geo[axis] - warp.base[axis])) : [0, 0];
  }
  const direction = from === 'rail' ? 1 : to === 'rail' ? -1 : 0;
  pan = camera.map((value, axis) => value + direction * cameraShift[axis] * 17 * zoom);
}

function renderAtlasView(view, moveFocus = false) {
  if (view !== mapView) retainAtlasCamera(mapView, view);
  if (!$('stationPlanner').hidden) closePlanner();
  mapView = view;
  $('railView').dataset.view = view;
  $('rentDock').hidden = view !== 'rail';
  $('roadDock').hidden = view !== 'roads';
  $('roadTools').hidden = view !== 'roads';
  $('stationSearch').hidden = view !== 'rail';
  $('mapViewTools').hidden = view !== 'rail';
  $('tip').hidden = true;

  if (view === 'living' || view === 'meeting') openPlanner(view);
  if (view === 'roads') loadOldRoads();
  for (const choice of atlasChoices) choice.setAttribute('aria-pressed', choice.dataset.atlasView === view);
  document.title = view === 'rail' ? '時間地図' : view === 'roads' ? '旧街道宿場地図' : $('plannerTitle').textContent;
  requestDraw();
  if (moveFocus) $('mapMenuOpen').focus({preventScroll:true});
}

function showAtlasView(view) {
  atlasPicker.close();
  if (view === mapView) return;
  history.pushState(null, '', view === 'rail' ? location.pathname + location.search : '#' + view);
  renderAtlasView(view, true);
}
function readAtlasView() {
  const view = location.hash.slice(1);
  return atlasViews.has(view) ? view : 'rail';
}
for (const choice of atlasChoices) choice.onclick = () => showAtlasView(choice.dataset.atlasView);
window.addEventListener('hashchange', () => renderAtlasView(readAtlasView(), true));
window.addEventListener('DOMContentLoaded', () => {
  renderAtlasView(readAtlasView());
  requestAnimationFrame(() => { $('initialLoading').hidden = true; });
});

function atlasPath(path, coords, close = false) {
  if (!coords.length) return;
  path.moveTo(...coords[0]);
  for (let i = 1; i < coords.length; i++) path.lineTo(...coords[i]);
  if (close) path.closePath();
}
function getGeographicPaths() {
  if (geographicPaths) return geographicPaths;
  const land = new Path2D(), tracks = new Path2D(), water = new Path2D(), green = new Path2D();
  const coordinates = ids => ids.map(id => points[id].geo);
  for (const ids of regionCoast) atlasPath(land, coordinates(ids), true);
  for (const ids of linePaths) if (ids) atlasPath(tracks, coordinates(ids));
  for (const {line, from, to} of regionalPaths) if (!LINES[line].bullet) {
    tracks.moveTo(...points[stationIndex[from]].geo);tracks.lineTo(...points[stationIndex[to]].geo);
  }
  for (const river of rivers) atlasPath(water, coordinates(river.ids));
  for (const park of parks) atlasPath(green, coordinates(park.ids), true);
  geographicPaths = {land, tracks, water, green};
  return geographicPaths;
}
function drawAtlasOverlay() {
  const scale = 17 * zoom;
  const dx = W / 2 + pan[0] - warp.base[0] * scale;
  const dy = H / 2 + pan[1] - warp.base[1] * scale;
  const bounds = [(-dx-24)/scale,(-dy-24)/scale,(W-dx+24)/scale,(H-dy+24)/scale];
  const project = ([x,y]) => [x * scale + dx, y * scale + dy];
  const geographic=getGeographicPaths();
  const {land, water, green}=mapView==='roads'?(getRoadBackdrop()??geographic):geographic;
  atlasHits = [];
  atlasLabels = [];
  ctx.fillStyle = '#dbe7e4';ctx.fillRect(0,0,W,H);
  ctx.save();
  ctx.transform(scale,0,0,scale,dx,dy);
  ctx.fillStyle = '#f1efe7';ctx.fill(land);
  ctx.lineWidth = .9/scale;ctx.strokeStyle = '#aabfb6';ctx.stroke(land);
  ctx.fillStyle = '#dce3d4';ctx.fill(green);
  ctx.lineWidth = 1.35/scale;ctx.strokeStyle = '#c6dcd6';ctx.stroke(water);
  if (mapView === 'roads') drawRoadLines(bounds,scale);
  else {
    ctx.lineWidth = .85/scale;ctx.strokeStyle = '#91a89d';ctx.globalAlpha = .55;ctx.stroke(geographic.tracks);
  }
  ctx.restore();
  if (mapView === 'roads') drawRoadStops(bounds,project);
  else drawPlannerMap(project);
  if (typeof drawDeviceLocation === 'function') {
    drawDeviceLocation(([x,y]) => project([x+warp.base[0], y+warp.base[1]]));
  }
}
function atlasDot(point, {label, color, radius, priority=false, action}) {
  const [x,y] = point;
  if (!visible(point,12)) return;
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);
  ctx.fillStyle = priority ? color : '#fbf9ef';ctx.fill();
  ctx.lineWidth = priority ? 1.8 : 1.15;ctx.strokeStyle = priority ? '#fbf9ef' : color;ctx.stroke();
  if (action) atlasHits.push({x,y,pick:action});
  if (!label || x<0 || y<(mapView==='roads'?105:23) || y>H-45) return;
  ctx.font = (priority?'650 12':'11')+'px system-ui,sans-serif';
  const width = ctx.measureText(label).width;
  const left = x+width+10>W ? x-width-8 : x+8;
  const box = [left-2,y-21,left+width+2,y-5];
  if (!priority && atlasLabels.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1])) return;
  ctx.lineJoin = 'round';ctx.lineWidth = 3;ctx.strokeStyle = '#f7f6ef';
  ctx.strokeText(label,left,y-7);ctx.fillStyle = '#30483e';ctx.fillText(label,left,y-7);
  atlasLabels.push(box);
  if(action)atlasHits.at(-1).box=box;
}
function hitAtlasOverlay(x,y) {
  let pick=null,best=14;
  for (const item of atlasHits) {
    const distance=Math.hypot(item.x-x,item.y-y);
    if(distance<best){best=distance;pick=item.pick;}
  }
  if(pick)return pick;
  return atlasHits.findLast(({box})=>box&&x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3])?.pick
    ?? (mapView==='roads'?hitRoadRing(x,y):null);
}
function centerAtlasPoint(point) {
  wheelZoom = null;
  pan = point.map((value, i) => -(value - warp.base[i]) * 17 * zoom);
  requestDraw();
}
function resetAtlasCamera() {
  if (mapView==='roads' && focusSelectedRoad()) return;
  if (mapView!=='roads' && focusPlannerResults()) return;
  wheelZoom = null;
  pan = [0,0];
  requestDraw();
}
