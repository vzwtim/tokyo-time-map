const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..')+'/';
const drawing=new Proxy({measureText:t=>({width:String(t).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});
const html=fs.readFileSync(root+'dist/index.html','utf8'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));let clock=1000;const elements={},created=[];
class El{constructor(){this.dataset={};this.children=[];this.hidden=false;this.style={setProperty(){}};this.classList={toggle(){}};this.attrs={};this.handlers={};created.push(this)}append(e){this.children.push(e);if(e.onload)e.onload()}replaceChildren(){this.children=[];this.textContent=''}setAttribute(k,v){this.attrs[k]=v}addEventListener(n,f){this.handlers[n]=f}getBoundingClientRect(){return {width:1064,height:787,left:0,top:0}}getContext(){return drawing}showModal(){}scrollIntoView(){}contains(e){return e===this||this.children.some(x=>x?.contains?.(e))}setPointerCapture(){}}
const documentHandlers={};const doc={addEventListener(n,f){documentHandlers[n]=f},getElementById(id){assert.ok(ids.has(id),'Missing '+id);return elements[id]??=new El()},createElement(){return new El()},createElementNS(){return new El()},head:new El(),querySelector(){return elements.dock??=new El()},querySelectorAll(q){const key=q.match(/data-(\w+)/)?.[1];return created.filter(e=>key&&e.dataset[key]!==undefined)}};
const data=JSON.parse(fs.readFileSync(root+'dist/rent-data.json','utf8'));let fetched=0;
const c={URL,URLSearchParams,location:{search:""},console,assert,Map,Set,Math,setTimeout,clearTimeout,performance:{now:()=>clock},document:doc,devicePixelRatio:1,matchMedia:()=>({matches:false}),fetch:async()=>{fetched++;return {ok:true,json:async()=>data}},window:{addEventListener(){}},requestAnimationFrame:f=>{c.drawNext=f;return 1;}};vm.createContext(c);
for(const f of ['data','routing-data','network-expansion','transfer-data','engine','rent-layer','app'])vm.runInContext(fs.readFileSync(root+'dist/'+f+'.js','utf8'),c);
const run=s=>vm.runInContext(s,c);
(async()=>{
clock=2100;c.drawNext(clock);assert.equal(fetched,0,'Normal map must not fetch rent');
run(`const before=points.length;const normal=lastScreen.map(p=>[...p]);`);
await elements.rentExplore.onclick();assert.equal(fetched,1);assert.equal(elements.rentQuick.attrs['aria-pressed'],true);assert.equal(elements.rentExplore.attrs['aria-pressed'],true);assert.equal(elements.timeExplore.attrs['aria-pressed'],false);c.drawNext(clock);
run(`assert.equal(layerMode,1);assert.equal(terrainDepth,0);assert.equal(points.length,before);assert.ok(!$('rentLegend').hidden);for(let i=0;i<before;i++)assert.ok(Math.hypot(normal[i][0]-lastScreen[i][0],normal[i][1]-lastScreen[i][1])<1e-7);`);
// Right drag starts the camera, never a station tap or pan.
elements.map.handlers.pointerdown({pointerId:8,clientX:700,clientY:300,button:2,preventDefault(){}});
elements.map.handlers.pointermove({pointerId:8,clientX:810,clientY:340});
elements.map.handlers.pointerup({pointerId:8,clientX:810,clientY:340,type:'pointerup'});
clock=2800;c.drawNext(clock);
run(`assert.equal(terrainDepth,1);assert.ok(yaw>.5);assert.ok(pitch>.72);assert.deepEqual(pan,[0,0]);assert.equal(tapTimer,null);assert.ok(lastScreen.every(p=>p.every(Number.isFinite)));const ring=ringTargets.find(r=>r.minute===20);assert.equal(hitRing(ring.center[0],ring.center[1]+ring.radius*ring.yScale),20);rentTab='profile';syncRentTabs();updateCards();assert.ok(!$('profileSelect').hidden);assert.equal($('placeCards').children[0].attrs.role,'img');const unknown=rentLayer.observed.findIndex(r=>r===null);showDestination(unknown);assert.equal($('destRent').textContent,'家賃相場なし');`);
await elements.timeExplore.onclick();assert.equal(elements.rentQuick.attrs['aria-pressed'],false);assert.equal(elements.rentExplore.attrs['aria-pressed'],false);assert.equal(elements.timeExplore.attrs['aria-pressed'],true);run(`assert.equal(terrainDepth,1,'Turning off rent must preserve camera');set3D(false);`);
clock=3500;c.drawNext(clock);
run(`assert.ok($('rentLegend').hidden);assert.ok($('rentTabs').hidden);assert.ok($('destRent').hidden);assert.equal($('placesTitle').textContent,'30分前後の駅');assert.equal(viewDepth(),0);for(let i=0;i<before;i++)assert.ok(Math.hypot(normal[i][0]-lastScreen[i][0],normal[i][1]-lastScreen[i][1])<1e-7);`);
await elements.rentQuick.onclick();run(`assert.equal(layerMode,1);rentTab='profile';syncRentTabs();updateCards();`);await elements.timeExplore.onclick();await elements.rentExplore.onclick();run(`assert.equal(rentTab,'stations');assert.ok($('placesTitle').textContent.includes('安い順'));`);assert.equal(fetched,1,'Re-entry must reuse rent data');
console.log('PASS: synchronized visible rent entry points, mode re-entry, cached data; lazy rent loading, independent layer/camera, right-drag orbit, ellipse hit testing, SVG profile, unknown rents, unchanged original coordinates.');
})().catch(e=>{console.error(e);process.exitCode=1});
