const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={console,Float64Array,Int32Array,Math,Set,performance,assert};vm.createContext(c);
vm.runInContext(fs.readFileSync('dist/data.js','utf8')+'\n'+fs.readFileSync('dist/routing-data.js','utf8')+'\n'+fs.readFileSync('dist/network-expansion.js','utf8')+'\n'+fs.readFileSync('dist/transfer-data.js','utf8')+'\n'+fs.readFileSync('dist/engine.js','utf8'),c);
vm.runInContext(`
assert.equal(new Set(STATIONS.map(s=>s.name)).size,STATIONS.length);
assert.ok(STATIONS.length>=730);
for(const station of STATIONS)assert.ok(LINES.some(line=>line.stops.includes(station.id)),'Missing railway connection: '+station.name);
let checked=0;
for(const name of ['新宿','東京','代々木上原','横浜','千葉','所沢']){
 const origin=S[name],rail=calculate(origin,'rail',true),local=calculate(origin,'rail',false),walk=calculate(origin,'walk'),warp=makeWarp(origin,rail),base=xy(STATIONS[origin]);
 assert.equal(rail.best[origin].time,0);
 for(const s of STATIONS){
  assert.ok(Number.isFinite(rail.best[s.id].time));
  assert.ok(rail.best[s.id].time<=walk.best[s.id].time+1e-7);
  assert.ok(rail.best[s.id].time<=local.best[s.id].time+1e-7);
  assert.ok(Math.abs(walk.best[s.id].time-walkMinutes(STATIONS[origin],s))<1e-7);
  const path=rail.route(s.id),sum=path.reduce((a,b)=>a+b.t+(b.wait||0),0);
  assert.ok(Math.abs(sum-rail.best[s.id].time)<1e-7);
  if(path.length)assert.equal(path[path.length-1].to,s.id);
  const p=warp.station(s.id),radius=Math.hypot(p[0]-base[0],p[1]-base[1]);
  assert.ok(Math.abs(radius-rail.best[s.id].time*.353)<1e-7);
  checked++;
 }
}
const point=[2.345,4.567],first=makeWarp(S['新宿'],calculate(S['新宿'])),second=makeWarp(S['東京'],calculate(S['東京']));first.point(point);const cached=second.point(point),fresh=second.point([...point]);assert.ok(Math.hypot(cached[0]-fresh[0],cached[1]-fresh[1])<1e-9,'Geographic interpolation weights must stay valid when origin changes');
console.log('PASS: '+checked+' origin/destination combinations; travel bounds, route totals, and radial time distances.');
`,c);
