const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const expected=JSON.parse(fs.readFileSync('tests/central-coverage.json','utf8'));
const c={assert,expected,console};vm.createContext(c);
vm.runInContext(['data','routing-data','network-expansion','transfer-data','engine'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
vm.runInContext(`
for(const [name,stops] of Object.entries(expected)){
 const l=LINES.find(l=>l.name===name);assert.ok(l,name);
 assert.deepEqual(l.stops.map(i=>STATIONS[i].name),Array.from(stops),name);
 const r=calculate(l.stops[0]);assert.ok(Number.isFinite(r.best[l.stops.at(-1)].time));
}
// The two Waseda stations are geographically separate and must not become one transfer node.
assert.notEqual(S['早稲田'],S['早稲田（都電）']);
for(const n of ['戸越銀座','池上','上町','柴又','京成上野','赤土小学校前','鬼子母神前','亀戸水神']){
 const result=calculate(S[n]);assert.ok(result.route(S['新宿']).some(e=>e.type==='rail'),n);
}
assert.equal(STATIONS.length,809);assert.equal(new Set(STATIONS.map(s=>s.name)).size,809);
console.log('PASS: 9 expanded routes, 809 unique stations, disconnected same-name stops remain separate.');
`,c);
