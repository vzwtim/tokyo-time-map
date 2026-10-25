const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const engine=fs.readFileSync('dist/engine.js','utf8');
const fixture={assert,console};vm.createContext(fixture);
vm.runInContext(`
const STATIONS=[{id:0,name:'A',lon:139.5,lat:35.7},{id:1,name:'J',lon:139.55,lat:35.7},{id:2,name:'B',lon:139.6,lat:35.7},{id:3,name:'C',lon:139.55,lat:35.75}];
const S={A:0,J:1,B:2,C:3};
const LINES=[{name:'甲',speed:1,express:false,stops:[0,1,2]},{name:'乙',speed:1,express:false,stops:[1,3]}];
const ROUTING_POLICY={boardingWait:3,transferWalk:5,stationExit:1,stationEntry:2,through:[['J','甲',1,'乙',0]]};
`+engine,fixture);
vm.runInContext(`
const arrival=calculate(S.B).route(S.J);
assert.equal(arrival.length,1);
assert.equal(arrival[0].boardWait,3);
assert.equal(arrival[0].dwell,0,'Final-arrival dwell must not be charged');
assert.equal(arrival[0].transferTime,0);
for(const [from,to] of [[S.B,S.C],[S.C,S.B]]){
 const r=calculate(from),path=r.route(to);
 assert.equal(r.summary(to).transfers,0);
 assert.equal(r.summary(to).boardingWait,3);
 assert.equal(r.summary(to).transferWalk,0);
 assert.ok(path.some(e=>e.through));
 assert.ok(path.filter(e=>e.through).every(e=>e.wait===0));
}
const differentDirection=calculate(S.A);
assert.equal(differentDirection.summary(S.C).transfers,1,'Wrong incoming direction must require an actual transfer');
assert.equal(differentDirection.summary(S.C).transferWalk,5);
assert.equal(differentDirection.summary(S.C).boardingWait,6);
const continuation=calculate(S.A).route(S.B);
assert.equal(continuation[0].dwell,0);
assert.equal(continuation[1].dwell,.4,'Intermediate stop belongs to next departure');
assert.equal(continuation[1].boardWait,0);
assert.equal(calculate(S.A),calculate(S.A),'Repeated origin must reuse the cached result');
console.log('PASS: no arrival dwell; waits only on boarding; directed and bidirectional through services; intermediate dwell; result caching.');
`,fixture);
const real={assert,console};vm.createContext(real);
vm.runInContext(['data','routing-data','network-expansion','transfer-data','engine'].map(f=>fs.readFileSync('dist/'+f+'.js','utf8')).join('\n'),real);
vm.runInContext(`
for(const [a,b] of [['下北沢','大手町'],['三軒茶屋','大手町'],['新宿','東京テレポート'],['笹塚','九段下'],['品川','浅草'],['亀有','大手町']]){
 const r=calculate(S[a]),s=r.summary(S[b]);assert.equal(s.transfers,0,a+' → '+b);assert.ok(s.through>0);assert.equal(s.boardingWait,3);assert.equal(s.transferWalk,0);assert.ok(Math.abs(s.total-r.best[S[b]].time)<1e-7);
}
assert.ok(!routingNetwork(false).adj.some(edges=>edges.some(e=>LINES[e.line].express)));
assert.ok(ROUTING_RESULT_CACHE.size<=8);
console.log('PASS: 6 real-network through journeys and express-off routing.');
`,real);
