const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('path').resolve(__dirname,'..')+'/',c={console,Map,Set,Math,performance,assert};vm.createContext(c);
for(const f of ['data','routing-data','network-expansion','engine','rent-layer'])vm.runInContext(fs.readFileSync(root+'dist/'+f+'.js','utf8'),c);
c.data=JSON.parse(fs.readFileSync(root+'dist/rent-data.json','utf8'));
vm.runInContext(`
const layer=createRentLayer(data,STATIONS,LINES,xy);
assert.ok(layer.count>=560);assert.ok(layer.observed.some(r=>r===null));
assert.equal(layer.observed[S['新宿']].source,'odakyuodawara');assert.equal(layer.observed[S['新宿']].rent,144200);
assert.ok(layer.discount(.5)===1);assert.ok(layer.discount(1)<1);assert.equal(layer.discount(10),.75);
const one=createRentLayer({sources:[],records:[{name:'A',rent:100000}]},[{id:0,name:'A',lon:0,lat:0}],[],()=>[0,0]);
const single=one.build([[0,0]],true);assert.equal(single.at([0,0]).value,100000);assert.ok(single.at([1.8,0]).value<single.at([1,0]).value);assert.equal(single.at([10,10]),null);
assert.ok(Math.abs(one.build([[0,0]],false).at([1.8,0]).value-100000)<1e-7);
let total=0;for(const name of ['新宿','横浜','大宮']){const result=calculate(S[name]),warp=makeWarp(S[name],result);
 for(const mix of [0,.5,1]){const positions=STATIONS.map(s=>{const p=xy(s),t=warp.station(s.id);return p.map((v,j)=>v-warp.base[j]+(t[j]-v)*mix);}),field=layer.build(positions,true,34);
 for(const tri of field.triangles){const [a,b,c]=tri.map(v=>v.p);const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);assert.ok(area>0,'No flipped or folded cell');}total+=field.triangles.length;
 for(const id of [S['新宿'],S['下北沢'],S['横浜']])if(layer.observed[id])assert.equal(field.at(positions[id]).value,layer.observed[id].rent);
 }}
assert.equal(layer.compare([]).length,0);const all=layer.compare(STATIONS.map(s=>s.id));assert.ok(all.length>25);assert.ok(all.every(l=>l.count>=3&&l.count/l.total>=.5));
for(let i=1;i<all.length;i++)assert.ok(all[i].median>=all[i-1].median);
const profile=layer.profile('小田急線');assert.equal(profile[0].name,'新宿');assert.equal(profile.at(-1).name,'相模大野');assert.equal(profile[0].rent,144200);
console.log('PASS: '+layer.count+' public station benchmarks; '+data.sources.length+' sources; '+total+' nonfolding triangles across nine origin/mix cases; distance hypothesis, station values, profiles and comparison coverage.');
`,c);
