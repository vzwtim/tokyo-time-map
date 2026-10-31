const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={assert,console};vm.createContext(c);
vm.runInContext(['data','routing-data','network-expansion','transfer-data','engine'].map(f=>fs.readFileSync('dist/'+f+'.js','utf8')).join('\n'),c);
vm.runInContext(`
// External timing benchmarks, not speed-formula snapshots. Sources in timing-audit.md.
const benchmarks=[['吉祥寺','新宿',15,15],['新宿','吉祥寺',14,16],
 ['荻窪','新宿',10,11],['中野','新宿',3.5,4.5],['新宿','東京',14,14],
 ['吉祥寺','渋谷',17,17],['渋谷','吉祥寺',16,16],
 ['渋谷','新宿',5,5],['新宿','渋谷',5,5],['池袋','新宿',5,5],
 ['新宿','池袋',5,5],['下北沢','新宿',7,8],['新宿','下北沢',7,9],
 ['三鷹','新宿',12,15],['立川','新宿',26,30],['二子玉川','渋谷',10,12]];
for(const [a,b,min,max] of benchmarks){
 const r=calculate(S[a]),s=r.summary(S[b]);
 assert.ok(s.total>=min-1e-7&&s.total<=max+1e-7,a+' → '+b+': '+s.total);
 assert.equal(s.boardingWait,0,a+' initial wait');
 assert.ok(Math.abs(s.total-r.best[S[b]].time)<1e-7);
}
for(const [line,a,b] of SEGMENT_TIMINGS){
 const l=LINES.find(l=>l.name===line);assert.ok(l,line);
 assert.ok(l.stops.some((id,i)=>STATIONS[id].name===a&&(STATIONS[l.stops[i+1]]?.name===b||STATIONS[l.stops[i-1]]?.name===b)),line+': '+a+' / '+b);
 for(const [from,to] of [[a,b],[b,a]]){const t=segmentTiming(line,from,to);assert.ok(t.run>0&&t.dwell>=0);}
}
// Changing definition must not remove genuine transfer waits.
let transferCount=0;
for(const [a,b] of [['吉祥寺','六本木'],['吉祥寺','銀座'],['渋谷','舞浜']]){
 const r=calculate(S[a]),s=r.summary(S[b]);
 if(s.transfers){assert.ok(s.boardingWait>=3);transferCount++;}
 for(const e of r.route(S[b]))if(e.through)assert.equal(e.wait,0);
 assert.ok(Math.abs(s.total-r.best[S[b]].time)<1e-7);
}
assert.ok(transferCount>0);
// Calibrated local rapid still works with optional express services switched off.
assert.equal(calculate(S['吉祥寺'],'rail',false).best[S['新宿']].time,15);
const firstWalk=calculate(S['東京']).summary(S['竹橋']);assert.equal(firstWalk.transfers,0);assert.equal(firstWalk.boardingWait,0,'Walking before the first train is not a transfer');
console.log('PASS: '+benchmarks.length+' external timing benchmarks; calibrated segments, reverse directions, transfers and express-off.');
`,c);
