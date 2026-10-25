const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const drawing=new Proxy({measureText:t=>({width:String(t).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});
const root=require('node:path').resolve(__dirname,'..')+'/',html=fs.readFileSync(root+'dist/index.html','utf8'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
let t=1000;const elements={},created=[];
class El{constructor(id){this.id=id;this.value='';this.dataset={};this.children=[];this.hidden=false;this.attrs={};this.handlers={};this.style={setProperty(){}};this.classList={toggle(){}};created.push(this);}append(x){this.children.push(x)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attrs[k]=v}addEventListener(n,f){this.handlers[n]=f}getBoundingClientRect(){return {width:1280,height:800,left:0,top:0,right:1280,bottom:800}}getContext(){return drawing}contains(e){return e===this||this.children.some(x=>x?.contains?.(e))}setPointerCapture(){}showModal(){}close(){}click(){this.onclick?.()}}
const documentHandlers={};const doc={addEventListener(n,f){documentHandlers[n]=f},getElementById(id){if(!ids.has(id))throw Error('Missing DOM element '+id);return elements[id]??=new El(id)},createElement(){return new El('')},querySelectorAll(q){if(q==='[data-minute]')return created.filter(e=>e.dataset.minute!==undefined);if(q==='[data-station]')return created.filter(e=>e.dataset.station!==undefined);return [];}};
const c={URL,URLSearchParams,location:{search:""},console,assert,Math,Float64Array,Int32Array,Set,Map,setTimeout,clearTimeout,performance:{now:()=>t},document:doc,devicePixelRatio:1,matchMedia:()=>({matches:false}),window:{addEventListener(){}},requestAnimationFrame:f=>{c.scheduled=f;return 1;}};vm.createContext(c);
for(const f of ['data.js','routing-data.js','network-expansion.js','transfer-data.js','engine.js','app.js'])vm.runInContext(fs.readFileSync(root+'dist/'+f,'utf8'),c,{filename:f});
function run(code){return vm.runInContext(code,c)}
t=2100;c.scheduled(t);
run(`
assert.equal(selectedMinute,30);
assert.ok(suggestionStations().length>0);
assert.ok(suggestionStations().every(s=>Math.abs(result.best[s.id].time-30)<=3));
const r=ringTargets.find(r=>r.minute===20);assert.ok(r);
const angle=1.9,x=r.center[0]+Math.cos(angle)*r.radius,y=r.center[1]+Math.sin(angle)*r.radius;
assert.equal(hitRing(x,y),20);
chooseMinute(20);assert.ok(suggestionStations().every(s=>Math.abs(result.best[s.id].time-20)<=3));
assert.equal($('placesTitle').textContent,'20分前後の駅');
// Recenter after panning must preserve every rendered point at the first frame.
pan=[124,-57];const before=points.map(p=>project(currentPoint(p)));
selectOrigin(S['代々木上原']);
assert.equal(animation.start,performance.now());
for(let i=0;i<points.length;i++){const after=project(currentPoint(points[i]));assert.ok(Math.hypot(before[i][0]-after[0],before[i][1]-after[1])<1e-7);}
assert.equal($('originName').textContent,'代々木上原');
`);
t=2600;c.scheduled(t);
run(`const old=points.map(p=>project(currentPoint(p)));selectOrigin(S['横浜']);for(let i=0;i<points.length;i++){const p=project(currentPoint(points[i]));assert.ok(Math.hypot(old[i][0]-p[0],old[i][1]-p[1])<1e-7);}`);
t=3800;c.scheduled(t);run(`assert.deepEqual(currentPan(),[0,0]);const p=lastScreen[stationIndex[origin]],b=baseScreen();assert.ok(Math.hypot(p[0]-b[0],p[1]-b[1])<1e-7);chooseMinute(40);showDestination(S['調布']);$('centerStation').click();assert.equal(origin,S['調布']);`);
t=5000;c.scheduled(t);

run(`assert.equal(stationTap(S['初台'],500,350,6000),'destination');assert.equal(stationTap(S['初台'],501,351,6250),'center');assert.equal(origin,S['初台']);`);
run(`selectOrigin(S['下北沢']);showDestination(S['大手町']);const rows=$('routeStepsBody').children;assert.equal(rows[0].className,'route-wait');assert.equal(rows[rows.length-1].className,'step');assert.ok(rows.some(r=>r.className==='route-through'));assert.equal(rows.filter(r=>r.className==='route-wait').length,1);assert.equal(routeChangeLabel(S['大手町']),'直通・乗換なし');`);
console.log('PASS: strict DOM boot; time-ring hits and suggestions; panned and interrupted transitions preserve first-frame positions; recenter target; double-tap and card controls.');
run(`
const returnUrl=new URL('https://sumu-eki.yudai-grex4.chatgpt.site/');returnUrl.hash='v1='+encodeURIComponent(JSON.stringify({v:1,config:{people:[]},pins:['新宿']}));location.search='?return='+encodeURIComponent(returnUrl.href);selected=S['下北沢'];updateSumuLink();const target=new URL($('sumuLink').href);assert.equal(target.hostname,'sumu-eki.yudai-grex4.chatgpt.site');assert.ok(JSON.parse(decodeURIComponent(target.hash.slice(4))).pins.includes('下北沢'));location.search='?return='+encodeURIComponent('https://example.com/');updateSumuLink();assert.equal(new URL($('sumuLink').href).hostname,'sumu-eki.yudai-grex4.chatgpt.site');
`);
console.log('PASS: comparison context return and external-return allowlist.');
// Mobile gestures: large rotation/vertical drift during a pinch MUST stay in 2D.
run(`dismissDestination();set3D(false);viewMotion=null;animation=null;pan=[0,0];zoom=1;yaw=0;pitch=.72;`);
const down=(id,x,y)=>elements.map.handlers.pointerdown({pointerId:id,clientX:x,clientY:y,button:0,pointerType:'touch',preventDefault(){}}),move=(id,x,y)=>elements.map.handlers.pointermove({pointerId:id,clientX:x,clientY:y,pointerType:'touch'}),up=(id,x,y,type='pointerup')=>elements.map.handlers[type]({pointerId:id,clientX:x,clientY:y,pointerType:'touch',type});
down(101,200,200);down(102,300,200);move(102,370,295);
run(`assert.equal(terrainDepth,0);assert.equal(yaw,0);assert.equal(pitch,.72);assert.ok(zoom>1);assert.ok(pan.every(Number.isFinite));const touchBase=baseScreen(),ratio=zoom/pinch.zoom,cx=(200+370)/2,cy=(200+295)/2;assert.ok(Math.abs((cx-touchBase[0]-pan[0])/zoom-(pinch.cx-touchBase[0]-pinch.pan[0])/pinch.zoom)<1e-7);assert.ok(Math.abs((cy-touchBase[1]-pan[1])/zoom-(pinch.cy-touchBase[1]-pinch.pan[1])/pinch.zoom)<1e-7);`);
up(102,370,295);move(101,220,210);up(101,220,210);run(`assert.equal(tapTimer,null);assert.equal(pointers.size,0);`);
run(`stationTap(S['東京'],500,300,20000);assert.ok(tapTimer!==null);$('closeCard').onclick();assert.equal(tapTimer,null);assert.equal(lastTap,null);assert.ok($('destinationCard').hidden);showDestination(S['東京']);`);
down(103,600,300);run(`assert.ok($('destinationCard').hidden);`);up(103,600,300,'lostpointercapture');run(`assert.equal(tapTimer,null);showDestination(S['東京']);`);
documentHandlers.keydown({key:'Escape'});run(`assert.ok($('destinationCard').hidden);showDestination(S['東京']);`);documentHandlers.pointerdown({target:elements.warpSlider});run(`assert.ok($('destinationCard').hidden);$('view3d').onclick();assert.equal(terrainDepth,1);assert.equal($('view3d').textContent,'2D');`);
down(104,200,200);move(104,250,230);up(104,250,230);run(`assert.ok(yaw>0);const angleBeforePinch=yaw,tiltBeforePinch=pitch;`);down(105,200,200);down(106,300,200);move(106,360,280);up(106,360,280);up(105,200,200);run(`assert.equal(yaw,angleBeforePinch);assert.equal(pitch,tiltBeforePinch);assert.equal(terrainDepth,1);$('view3d').onclick();assert.equal(terrainDepth,0);assert.equal($('view3d').textContent,'3D');`);
console.log('PASS: 2D pinch drift never activates 3D; focal zoom and pan; cancellation has no phantom tap; popup dismisses on map/outside/Escape and cancels pending reopen; explicit 3D touch orbit with independent pinch zoom.');
