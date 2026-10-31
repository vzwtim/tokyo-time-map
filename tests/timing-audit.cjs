const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={assert,console};vm.createContext(c);
vm.runInContext(['data','routing-data','network-expansion','transfer-data','engine'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
vm.runInContext(`
const net=routingNetwork(true);let segments=0;
assert.equal(new Set(TIMING_OBSERVATIONS.map(p=>p.id)).size,TIMING_OBSERVATIONS.length);
for(const p of TIMING_OBSERVATIONS){
 assert.ok(p.source.startsWith('https://transit.yahoo.co.jp/'));assert.ok(p.observedDate);
 const l=LINES.findIndex(l=>l.name===p.line),ids=p.stops.map(s=>S[s]);let ride=0;
 for(let i=1;i<ids.length;i++){
  const e=net.adj[ids[i-1]].find(e=>e.line===l&&e.to===ids[i]);assert.ok(e,p.id);
  assert.equal(e.run+(i>1?e.dwell:0),p.offsets[i]-p.offsets[i-1],p.id+' segment '+i);
  ride+=e.run+(i>1?e.dwell:0);segments++;
  // An observation in one direction must not silently certify the reverse.
  assert.notEqual(segmentTiming(p.line,p.stops[i],p.stops[i-1])?.observed,true);
 }
 assert.equal(ride,p.offsets.at(-1));
 assert.ok(calculate(ids[0]).best[ids.at(-1)].time<=ride+1e-7,'A known direct service must be reachable');
}
// Independent end-to-end expectations from cited passenger journey results.
for(const [a,b,min,max] of [['池袋','川越',31,33],['北千住','柏',16,18],['東京','千葉',38,40],['渋谷','浅草',34,36],['代々木上原','綾瀬',39,41],['渋谷','押上',30,32],['新宿','光が丘',24,26],['東京','舞浜',15,17],['横浜','海老名',27,29],['大手町','西船橋',23,25],['新宿','調布',16,18]]){
 const t=calculate(S[a]).best[S[b]].time;assert.ok(t>=min&&t<=max,a+' → '+b+': '+t);
}
assert.equal(calculate(S['大手町'],'rail',false).best[S['西船橋']].time,32,'Local and rapid must remain separate');
assert.ok(!routingNetwork(false).adj.some(a=>a.some(e=>LINES[e.line].express)));
assert.deepEqual(LINES.find(l=>l.name==='京王線特急').stops.map(i=>STATIONS[i].name),['新宿','笹塚','明大前','千歳烏山','調布','府中','分倍河原','聖蹟桜ヶ丘','高幡不動','北野','京王八王子']);
assert.ok(LINES.find(l=>l.name==='半蔵門線').stops.includes(S['半蔵門']));
console.log('PASS: '+TIMING_OBSERVATIONS.length+' cited service samples, '+segments+' directed segments, distinct rapid/local journeys and repaired stops.');
`,c);
