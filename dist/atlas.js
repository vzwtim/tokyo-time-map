'use strict';

const atlasPicker = $('atlasPicker');
const mapOptions = $('mapOptions');
const atlasChoices = [...atlasPicker.querySelectorAll('[data-atlas-view]')];
const atlasViews = new Set(atlasChoices.map(choice => choice.dataset.atlasView));
let activeAtlasView = null;

for (const dialog of [atlasPicker, mapOptions]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

for (const button of [$('mapMenuOpen'), ...document.querySelectorAll('[data-atlas-picker]')]) {
  button.onclick = () => atlasPicker.showModal();
}
$('mapSettingsOpen').onclick = () => mapOptions.showModal();
$('aboutBtn').addEventListener('click', closeMapMenu, {capture:true});

function renderAtlasView(view, line = null, moveFocus = false) {
  if (view === activeAtlasView && !line) return;
  if (!$('stationPlanner').hidden) closePlanner();

  activeAtlasView = view;
  const rail = view === 'rail';
  $('railView').hidden = !rail;
  $('roadsView').hidden = view !== 'roads';
  if (view === 'living' || view === 'meeting') openPlanner(view, line);
  if (view === 'roads') loadOldRoads();
  if (rail) resize();
  for (const choice of atlasChoices) choice.setAttribute('aria-pressed', choice.dataset.atlasView === view);
  document.title = rail ? '時間地図' : view === 'roads' ? '旧街道宿場地図' : $('plannerTitle').textContent;
  window.scrollTo(0, 0);

  if (moveFocus) {
    const target = rail ? $('mapMenuOpen') : (view === 'roads' ? $('roadsTitle') : $('plannerTitle'));
    if (!rail) target.tabIndex = -1;
    target.focus({preventScroll:true});
  }
}

function showAtlasView(view, line = null) {
  atlasPicker.close();
  if (view !== activeAtlasView) {
    // Preserve the existing query string used by links from the commute optimizer.
    history.pushState(null, '', view === 'rail' ? location.pathname + location.search : '#' + view);
  }
  renderAtlasView(view, line, true);
}

function readAtlasView() {
  const view = location.hash.slice(1);
  return atlasViews.has(view) ? view : 'rail';
}

for (const choice of atlasChoices) choice.onclick = () => showAtlasView(choice.dataset.atlasView);
window.addEventListener('hashchange', () => renderAtlasView(readAtlasView(), null, true));
window.addEventListener('DOMContentLoaded', () => renderAtlasView(readAtlasView()));
