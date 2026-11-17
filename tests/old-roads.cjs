const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const asset=file=>path.join(__dirname,'../dist',file);
const engine=fs.readFileSync(asset('engine.js'),'utf8');
const context=vm.createContext({assert,packed:JSON.parse(fs.readFileSync(asset('old-roads.json'),'utf8'))});
vm.runInContext(engine+fs.readFileSync(asset('road-routing.js'),'utf8')+`
 const coordinates=([lon,lat])=>xy({lon,lat});
 const roads=packed.map(([,name,paths,stops])=>({name,paths:paths.map(path=>path.map(coordinates)),
   stops:stops.map(([name,,region,lon,lat,hub])=>({name,region,hub,point:coordinates([lon,lat])}))}));
 const graph=buildRoadGraph(roads);
 const station=(name,road)=>roads.find(row=>row.name===road).stops.find(stop=>stop.name===name);
 const start=station('千住','奥州道中'), destination=station('品川','東海道');
 const route=routeOldRoads(graph,start), distances=route.distances, trip=route.path(destination);
 assert.ok(distances[destination.index]>12&&distances[destination.index]<25);
 assert.equal(routeOldRoads(graph,destination).distances[start.index],distances[destination.index]);
 assert.deepEqual(trip.filter(step=>!step.road).map(step=>step.from.name).filter((name,i,list)=>i===0||list[i-1]!==name),['日本橋']);
 assert.ok(trip.every(edge=>roadEdgePoints(edge).every(point=>point.every(Number.isFinite))));
 const branch=station('下諏訪','甲州道中');
 assert.ok(graph.groups.get(branch.hub).some(stop=>stop.road.name==='中山道'));
 assert.ok(roads.some(road=>road.name==='水戸街道'));
 assert.ok(graph.stops.some(stop=>!stop.snap));
 assert.ok(graph.stops.every(stop=>!stop.snap||roadDistance(stop.point,stop.snap.point)<=3.5));
`,context);
console.log('PASS: Edo-road distance symmetry, named hub transfer, and off-route stop handling.');
