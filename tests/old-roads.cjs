const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const asset=file=>path.join(__dirname,'../dist',file);
const engine=fs.readFileSync(asset('engine.js'),'utf8');
const context=vm.createContext({assert,packed:[...JSON.parse(fs.readFileSync(asset('old-roads.json'),'utf8')),...JSON.parse(fs.readFileSync(asset('old-roads-extra.json'),'utf8'))]});
vm.runInContext(engine+fs.readFileSync(asset('road-routing.js'),'utf8')+`
 const coordinates=([lon,lat])=>xy({lon,lat});
 const roads=mergeRoadEntries(packed).map(([id,name,paths,stops])=>({id,name,paths:paths.map(path=>path.map(coordinates)),
   stops:stops.map(([name,,region,lon,lat,hub])=>({name,region,hub,point:coordinates([lon,lat])}))}));
 const graph=buildRoadGraph(roads);
 const station=(name,road)=>roads.find(row=>row.name===road).stops.find(stop=>stop.name===name);
 const start=station('千住','奥州道中'), destination=station('品川','東海道');
 const route=routeOldRoads(graph,start), distances=route.distances, trip=route.path(destination);
 assert.ok(distances[destination.index]>12&&distances[destination.index]<25);
 assert.equal(routeOldRoads(graph,destination).distances[start.index],distances[destination.index]);
 assert.deepEqual(trip.filter(step=>!step.road).map(step=>step.from.name).filter((name,i,list)=>i===0||list[i-1]!==name),['日本橋']);
 assert.ok(trip.every(edge=>roadEdgePoints(edge).every(point=>point.every(Number.isFinite))));
 const matsumae=roads.find(road=>road.id==='R200');
 assert.equal(roads.filter(road=>road.id==='R200').length,1);
 assert.equal(matsumae.stops.length,15);
 assert.equal(matsumae.paths.length,2);
 const hakodate=station('函館','松前街道'),matsumaeOrigin=station('松前','松前街道');
 assert.ok(Number.isFinite(routeOldRoads(graph,matsumaeOrigin).distances[hakodate.index]));
 assert.equal(routeOldRoads(graph,station('三厩','松前街道')).distances[hakodate.index],Infinity);
 const tokyo=routeOldRoads(graph,station('日本橋','東海道'));
 for(const [name,road] of [['伏見','京街道'],['日永の追分','伊勢街道'],['本荘','羽州浜街道'],['入善','北陸街道']]){
   const stop=station(name,road),trail=tokyo.path(stop);
   assert.ok(Number.isFinite(tokyo.distances[stop.index]),road+' must connect at a mapped junction');
   assert.ok(trail.every(edge=>roadEdgePoints(edge).every(point=>point.every(Number.isFinite))));
 }
 for(const [name,road] of [['大山','大山街道'],['大内','会津西街道'],['若松','会津西街道']]){
   const stop=station(name,road);assert.ok(Number.isFinite(tokyo.distances[stop.index]),road+' must connect to the existing map');
 }
 const aizu=routeOldRoads(graph,station('今市','会津西街道'));
 assert.ok(aizu.distances[station('大内','会津西街道').index]>70);
 assert.ok(aizu.distances[station('大内','会津西街道').index]<130);
 assert.equal(roads.find(road=>road.id==='R222').stops.length,18);
 const branch=station('下諏訪','甲州道中');
 assert.ok(graph.groups.get(branch.hub).some(stop=>stop.road.name==='中山道'));
 assert.ok(roads.some(road=>road.name==='水戸街道'));
 assert.equal(graph.stops.filter(stop=>!stop.snap).length,0);
 assert.ok(graph.stops.every(stop=>stop.snap&&roadDistance(stop.point,stop.snap.point)<.01));
 assert.ok(graph.stops.every(stop=>graph.edges[stop.index].length>0));
 for(const name of ['二子','愛甲','糟屋','赤坂御門','三軒茶屋'])assert.ok(station(name,'大山街道'));
 assert.ok(Number.isFinite(tokyo.distances[station('富山','北陸街道').index]));
 assert.ok(Number.isFinite(tokyo.distances[station('本宮','熊野街道').index]));
 assert.ok(Number.isFinite(routeOldRoads(graph,station('高松','伊予街道')).distances[station('川之江','伊予街道').index]));
`,context);
console.log('PASS: Road symmetry, multipart roads, branch junctions, sea-gap isolation and off-route stops.');

const roadUI=fs.readFileSync(asset('old-roads.js'),'utf8');
vm.runInContext(`
 const oldRoadData=roads,cyclingByHub=new Map(),riddenHubs=new Set(),cyclingMapEpisodes=[];
 const riddenRoads=new Set(['R001','R002','R003','R005','R303','R312']);
 const riddenSections=[['R004','日本橋','白河'],['R222','今市','大内']],cyclingEpisodes=[];
 let cyclingGeoShapes,cyclingSegments;
`+roadUI.slice(roadUI.indexOf('function indexCyclingEpisodes'),roadUI.indexOf('function cyclingShapes'))+`
 indexCyclingEpisodes();
 const wasRidden=(name,road)=>riddenHubs.has(station(name,road).hub);
 assert.ok(wasRidden('大山','大山街道'));
 assert.ok(wasRidden('厚木','大山街道'));
 assert.ok(wasRidden('今市','会津西街道'));
 assert.ok(wasRidden('大内','会津西街道'));
 assert.equal(wasRidden('関山','会津西街道'),false);
 assert.equal(wasRidden('福永','会津西街道'),false);
 assert.equal(wasRidden('若松','会津西街道'),false);
 assert.ok(cyclingSegments.filter(edge=>edge.road.id==='R222').every(edge=>edge.from.point[1]>=station('大内','会津西街道').point[1]&&edge.to.point[1]>=station('大内','会津西街道').point[1]));
`,context);
console.log('PASS: Added roads connect to existing hubs; completed Aizu section stops precisely at Ouchi.');
