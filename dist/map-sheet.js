'use strict';

function bindMapSheet(sheet, handle, body, onChange) {
  let level = 0, drag = null, ignoreClick = false;

  function heights() {
    const available = sheet.parentElement.clientHeight;
    return [76, Math.min(340, available * .49), Math.min(680, available * .82)];
  }

  function setLevel(next) {
    level = next;
    sheet.dataset.sheetLevel = level;
    body.hidden = level === 0;
    handle.setAttribute('aria-expanded', level > 0);
    handle.style.cursor = level === 2 ? 's-resize' : 'n-resize';
    onChange(level);
  }

  handle.onclick = () => { if (!ignoreClick) setLevel(level ? 0 : 1); };
  handle.onkeydown = event => {
    const direction = {ArrowUp: 1, ArrowDown: -1}[event.key];
    if (!direction) return;
    event.preventDefault();
    setLevel(Math.max(0, Math.min(2, level + direction)));
  };
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    ignoreClick = false;
    drag = {id: event.pointerId, y: event.clientY, start: sheet.offsetHeight, moved: false};
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const delta = drag.y - event.clientY;
    if (!drag.moved && Math.abs(delta) < 8) return;
    drag.moved = true;
    body.hidden = false;
    const [min, , max] = heights();
    sheet.parentElement.style.setProperty('--drag-sheet-height', Math.max(min, Math.min(max, drag.start + delta)) + 'px');
  });
  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    const {moved, y, start} = drag;
    drag = null;
    sheet.parentElement.style.removeProperty('--drag-sheet-height');
    if (!moved) return;
    ignoreClick = true;
    setTimeout(() => { ignoreClick = false; }, 0);
    if (event.type !== 'pointerup') { setLevel(level); return; }
    const delta = y - event.clientY;
    const sizes = heights();
    let target = sizes.reduce((nearest, height, index) =>
      Math.abs(height - start - delta) < Math.abs(sizes[nearest] - start - delta) ? index : nearest, level);
    if (target === level && Math.abs(delta) >= 32) target = Math.max(0, Math.min(2, level + Math.sign(delta)));
    setLevel(target);
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(event, finishDrag);
  return setLevel;
}

let sheetLevel = 0;
const setSheetLevel = bindMapSheet($('rentDock'), $('sheetHandle'), $('sheetBody'), level => {
  sheetLevel = level;
  updateSheetSummary();
  requestDraw();
});
function updateSheetSummary() {
  const sheet = $('rentDock'), sheetBody = $('sheetBody');
  const stationDetails = !$('destinationCard').hidden && !(layerMode && rentPanelActive);
  const title = stationDetails ? STATIONS[origin].name + ' → ' + $('destName').textContent
    : $('placesTitle').textContent;
  const duration = $('destTime').textContent;
  const meta = stationDetails ? (duration === '—' ? '経路なし' : '約' + duration + '分 · ' + routeChangeLabel(selected))
    : $('suggestionMeta').textContent;
  $('sheetTitle').textContent = title;
  $('sheetMeta').textContent = meta;
  const content = stationDetails ? 'station' : 'explore';
  if (sheet.dataset.content !== content) sheetBody.scrollTop = 0;
  sheet.dataset.content = content;
}

setSheetLevel(0);
