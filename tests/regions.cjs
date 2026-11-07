const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context=vm.createContext({assert});
for(const name of ['data','routing-data','network-expansion','transfer-data','geodata','regions','engine']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',name+'.js'),'utf8'),context,{filename:name});
}
vm.runInContext(`
const a=S['吉祥寺'], b=S['なんば'];
const on=calculate(a,'rail',true,true), off=calculate(a,'rail',true,false);
assert(STATIONS.length>=9046);
assert.equal(Object.keys(geoIds).length,9046);
assert.equal(new Set(Object.values(geoIds)).size,9046);
assert.equal(RAIL_GEODATA.lines.length,596);
assert(STATIONS.some(s=>s.name==='稚内'));
assert(STATIONS.some(s=>s.name==='枕崎'));
assert(on.best[b].time<off.best[b].time && Number.isFinite(off.best[b].time));
assert(on.route(b).some(step=>LINES[step.line]?.bullet));
assert(off.route(b).every(step=>!LINES[step.line]?.bullet));
assert(on.route(b).some(step=>LINES[step.line]?.name.includes('御堂筋線')));
assert(calculate(S['梅田'],'rail',true,false).best[b].time<20);
const shinFuji=geoIds[RAIL_GEODATA.bullet_stops['新富士']];
assert(Number.isFinite(on.best[shinFuji].time));
assert.equal(calculate(shinFuji,'rail',true,false).best[a].time,Infinity);
assert(makeWarp(a,off).station(shinFuji).every(Number.isFinite));
assert(Number.isFinite(on.best[findStation('札幌','北海道')].time));
assert(!Number.isFinite(off.best[findStation('札幌','北海道')].time));
assert(Number.isFinite(off.best[findStation('高知','四国')].time));
assert(Number.isFinite(on.best[findStation('鹿児島中央','九州')].time));
assert(!Number.isFinite(on.best[findStation('那覇空港','沖縄')].time));
assert(Number.isFinite(calculate(findStation('那覇空港','沖縄')).best[findStation('てだこ浦西','沖縄')].time));
assert(Number.isFinite(on.best[findStation('西藤原')].time));
for(const route of [on,off]) assert(Math.abs(route.best[b].time-route.summary(b).total)<1e-8);
`,context);
console.log('PASS: regional and cross-region journeys, Shinkansen switch, unreachable stations and summaries.');
