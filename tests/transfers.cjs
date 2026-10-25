const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),c={Math,Map,Set,console,assert,performance};vm.createContext(c);for(const f of ['data','routing-data','network-expansion','transfer-data','engine'])vm.runInContext(fs.readFileSync('dist/'+f+'.js','utf8'),c);
vm.runInContext(`
const lineId=name=>LINES.findIndex(l=>l.name===name);
for(const [station,a,b,t]of TRANSFER_MODEL.pairs){assert.ok(S[station]!==undefined,station);assert.ok(Number.isFinite(t)&&t>=1&&t<=20);for(const n of [a,b])if(n!=='*')assert.ok(LINES.some(l=>transferLineFamily(l.name)===n&&l.stops.includes(S[station])),station+' / '+n);}
assert.equal(modeledTransferMinutes(S['東京'],lineId('山手線'),lineId('京葉線'),0,0),12);
assert.equal(modeledTransferMinutes(S['東京'],lineId('京葉線'),lineId('山手線'),1,1),12);
assert.equal(modeledTransferMinutes(S['表参道'],lineId('銀座線'),lineId('半蔵門線'),0,0),2);
assert.equal(modeledTransferMinutes(S['表参道'],lineId('銀座線'),lineId('半蔵門線'),0,1),4);
const n=routingNetwork(true),a=lineId('山手線'),b=lineId('京葉線');assert.equal(n.transfers[S['東京']].get((a*2)*n.stride+b*2),12);
for(const [from,to]of [['神田','舞浜'],['舞浜','神田'],['代々木','初台'],['渋谷','新宿'],['銀座','押上']]){const r=calculate(S[from]);assert.ok(Math.abs(r.summary(S[to]).total-r.best[S[to]].time)<1e-7);for(const e of r.route(S[to]))if(e.through)assert.equal(e.wait,0);}
console.log('PASS: '+TRANSFER_MODEL.pairs.length+' valid station/pair estimates; compiled table, direction-sensitive platform change, reverse paths and exact journey totals.');
`,c);
