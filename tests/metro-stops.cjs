const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={console,assert};vm.createContext(c);
vm.runInContext(['data','routing-data','network-expansion','transfer-data','engine'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
vm.runInContext(`
const expected={
'日比谷線':'中目黒 恵比寿 広尾 六本木 神谷町 虎ノ門ヒルズ 霞ケ関 日比谷 銀座 東銀座 築地 八丁堀 茅場町 人形町 小伝馬町 秋葉原 仲御徒町 上野 入谷 三ノ輪 南千住 北千住',
'千代田線':'代々木上原 代々木公園 明治神宮前 表参道 乃木坂 赤坂 国会議事堂前 霞ケ関 日比谷 二重橋前 大手町 新御茶ノ水 湯島 根津 千駄木 西日暮里 町屋 北千住 綾瀬 北綾瀬',
'南北線':'目黒 白金台 白金高輪 麻布十番 六本木一丁目 溜池山王 永田町 四ツ谷 市ケ谷 飯田橋 後楽園 東大前 本駒込 駒込 西ケ原 王子 王子神谷 志茂 赤羽岩淵',
'銀座線':'渋谷 表参道 外苑前 青山一丁目 赤坂見附 溜池山王 虎ノ門 新橋 銀座 京橋 日本橋 三越前 神田 末広町 上野広小路 上野 稲荷町 田原町 浅草'};
for(const [name,stops] of Object.entries(expected))assert.deepEqual(LINES.find(l=>l.name===name).stops.map(i=>STATIONS[i].name),stops.split(' '));
for(const name of ['広尾','小伝馬町','代々木公園','北綾瀬','西ケ原','上野広小路']){
 assert.equal(STATIONS.filter(s=>s.name===name).length,1);
 const result=calculate(S[name]);assert.equal(result.best[S[name]].time,0);
 assert.ok(Number.isFinite(result.best[S['新宿']].time));
 assert.ok(result.route(S['新宿']).some(e=>e.type==='rail'),name+' must participate in rail routing');
}
assert.ok(!LINES.find(l=>l.name==='日比谷線').stops.some((id,i,a)=>STATIONS[id].name==='恵比寿'&&STATIONS[a[i+1]]?.name==='六本木'));
console.log('PASS: 4 complete Metro stop sequences, 6 new searchable stations and rail journeys.');
`,c);
