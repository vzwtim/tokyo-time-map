'use strict';

const sheet = $('rentDock');
const sheetHandle = $('sheetHandle');
const sheetBody = $('sheetBody');
const layerMenu = $('mapOptions');
$('mapMenuOpen').onclick = () => layerMenu.showModal();
layerMenu.addEventListener('click', event => {
  if (event.target !== layerMenu) return;
  const bounds = layerMenu.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) closeMapMenu();
});
$('aboutBtn').addEventListener('click', () => closeMapMenu(), {capture:true});
let sheetLevel = 0;
let sheetDrag = null;
let ignoreSheetClick = false;

function sheetHeights() {
  const available = sheet.parentElement.clientHeight;
  return [76, Math.min(340, available * .49), Math.min(680, available * .82)];
}

function setSheetLevel(level) {
  sheetLevel = level;
  sheet.dataset.sheetLevel = level;
  sheetBody.hidden = level === 0;
  sheetHandle.setAttribute('aria-expanded', level > 0);
  sheetHandle.style.cursor = level === 2 ? 's-resize' : 'n-resize';
  updateSheetSummary();
  requestDraw();
}

function updateSheetSummary() {
  const planning = !$('stationPlanner').hidden;
  const stationDetails = !$('destinationCard').hidden && !(layerMode && rentPanelActive);
  const title = planning ? $('plannerTitle').textContent
    : stationDetails ? STATIONS[origin].name + ' → ' + $('destName').textContent
    : $('placesTitle').textContent;
  const duration = $('destTime').textContent;
  const meta = planning ? (plannerMode === 'living' ? plannerLine || '' : '')
    : stationDetails ? (duration === '—' ? '経路なし' : '約' + duration + '分 · ' + routeChangeLabel(selected))
    : $('suggestionMeta').textContent;
  $('sheetTitle').textContent = title;
  $('sheetMeta').textContent = meta;
  const content = planning ? 'planner' : stationDetails ? 'station' : 'explore';
  if (sheet.dataset.content !== content) sheetBody.scrollTop = 0;
  sheet.dataset.content = content;
}

function syncLayerModes() {
  const planning = !$('stationPlanner').hidden;
  for (const [id, active] of [
    ['timeExplore', !planning && !layerMode],
    ['rentExplore', !planning && !!layerMode],
    ['livingOpen', planning && plannerMode === 'living'],
    ['meetingOpen', planning && plannerMode === 'meeting'],
  ]) $(id).setAttribute('aria-pressed', active);
}

function activateBaseLayer(rent) {
  closePlanner();
  closeMapMenu();
  set3D(false);
  if (mix < .98) changeMix(1, true);
  setSheetLevel(0);
  setLayer(rent).then(() => {
    if (rent && !layerMode && $('stationPlanner').hidden && $('dockModeHint').textContent.includes('読み込めません')) {
      setSheetLevel(1);
    }
  });
}

$('timeExplore').onclick = () => activateBaseLayer(false);
$('rentExplore').onclick = () => activateBaseLayer(true);
for (const [id, kind] of [['livingOpen', 'living'], ['meetingOpen', 'meeting']]) {
  $(id).onclick = () => {
    closeMapMenu();
    openPlanner(kind);
  };
}

sheetHandle.onclick = () => {
  if (ignoreSheetClick) return;
  setSheetLevel(sheetLevel ? 0 : 1);
};
sheetHandle.onkeydown = event => {
  const direction = {ArrowUp: 1, ArrowDown: -1}[event.key];
  if (!direction) return;
  event.preventDefault();
  setSheetLevel(Math.max(0, Math.min(2, sheetLevel + direction)));
};
sheetHandle.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  ignoreSheetClick = false;
  sheetDrag = {id: event.pointerId, y: event.clientY, start: sheet.offsetHeight, moved: false};
  sheetHandle.setPointerCapture(event.pointerId);
});
sheetHandle.addEventListener('pointermove', event => {
  if (sheetDrag?.id !== event.pointerId) return;
  const delta = sheetDrag.y - event.clientY;
  if (!sheetDrag.moved && Math.abs(delta) < 8) return;
  sheetDrag.moved = true;
  sheetBody.hidden = false;
  const [min, , max] = sheetHeights();
  sheet.parentElement.style.setProperty('--drag-sheet-height', Math.max(min, Math.min(max, sheetDrag.start + delta)) + 'px');
});
function finishSheetDrag(event) {
  if (sheetDrag?.id !== event.pointerId) return;
  const {moved, y, start} = sheetDrag;
  sheetDrag = null;
  sheet.parentElement.style.removeProperty('--drag-sheet-height');
  if (!moved) return;
  ignoreSheetClick = true;
  setTimeout(() => { ignoreSheetClick = false; }, 0);
  if (event.type === 'pointercancel' || event.type === 'lostpointercapture') {
    setSheetLevel(sheetLevel);
    return;
  }
  const delta = y - event.clientY;
  const heights = sheetHeights();
  let target = heights.reduce((nearest, height, index) =>
    Math.abs(height - start - delta) < Math.abs(heights[nearest] - start - delta) ? index : nearest, sheetLevel);
  if (target === sheetLevel && Math.abs(delta) >= 32) target = Math.max(0, Math.min(2, sheetLevel + Math.sign(delta)));
  setSheetLevel(target);
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  sheetHandle.addEventListener(event, finishSheetDrag);
}
setSheetLevel(0);
syncLayerModes();
