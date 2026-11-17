'use strict';

const roadDistance = (a,b) => {
  const latitude = (35.69 - (a[1]+b[1])/(2*KM_LAT)) * Math.PI/180;
  return Math.hypot((a[0]-b[0]) * KM_LAT/KM_LON * Math.cos(latitude),a[1]-b[1]);
};

function buildRoadGraph(roads) {
  const stops = [], groups = new Map(), edges = [];
  const link = (a,b,road,distance) => {
    edges[a.index].push({from:a,to:b,road,distance});
    edges[b.index].push({from:b,to:a,road,distance});
  };
  for (const road of roads) {
    const lengths = road.paths.map(path => {
      const cumulative = [0];
      for (let i=1;i<path.length;i++) cumulative.push(cumulative.at(-1)+roadDistance(path[i-1],path[i]));
      return cumulative;
    });
    const stopsByPath = road.paths.map(()=>[]);
    for (const stop of road.stops) {
      stop.index = stops.length;
      stop.road = road;
      stops.push(stop);
      edges.push([]);
      if (!groups.has(stop.hub)) groups.set(stop.hub,[]);
      groups.get(stop.hub).push(stop);
      let best = Infinity;
      for (const [pathIndex,path] of road.paths.entries()) {
        for (let i=1;i<path.length;i++) {
          const a=path[i-1], b=path[i], dx=b[0]-a[0], dy=b[1]-a[1];
          const portion = Math.min(1,Math.max(0,((stop.point[0]-a[0])*dx+(stop.point[1]-a[1])*dy)/(dx*dx+dy*dy || 1)));
          const projected=[a[0]+dx*portion,a[1]+dy*portion];
          const error=roadDistance(stop.point,projected);
          if (error>=best) continue;
          best=error;
          const cumulative=lengths[pathIndex];
          stop.snap={path:pathIndex,segment:i-1,point:projected,kilometres:cumulative[i-1]+(cumulative[i]-cumulative[i-1])*portion};
        }
      }
      // Keep off-route points searchable, without attaching them to distant segments.
      if(stop.snap && best<=3.5) stopsByPath[stop.snap.path].push(stop);
      else stop.snap=null;
    }
    road.stopsByPath=stopsByPath;
    for(const ordered of stopsByPath){
      ordered.sort((a,b)=>a.snap.kilometres-b.snap.kilometres);
      for(let i=1;i<ordered.length;i++)link(ordered[i-1],ordered[i],road,ordered[i].snap.kilometres-ordered[i-1].snap.kilometres);
    }
  }
  for(const members of groups.values()) {
    for(let i=1;i<members.length;i++) {
      if(roadDistance(members[0].point,members[i].point)<1)link(members[0],members[i],null,0);
    }
  }
  return {stops,groups,edges};
}

function routeOldRoads(graph, origin) {
  const costs = new Float64Array(graph.stops.length).fill(Infinity);
  const distances = new Float64Array(graph.stops.length).fill(Infinity);
  const previous = [];
  const heap = new Heap();
  // Prefer a continuous road over sub-block distance savings. This bias is not travel time.
  costs[origin.index] = distances[origin.index] = 0;
  heap.push([0,origin.index]);
  while(heap.a.length){
    const [cost,id]=heap.pop();
    if(cost>costs[id])continue;
    for(const edge of graph.edges[id]){
      const index=edge.to.index, next=cost+edge.distance+(edge.road?0:.15);
      if(next>=costs[index])continue;
      costs[index]=next;
      distances[index]=distances[id]+edge.distance;
      previous[index]=edge;
      heap.push([next,index]);
    }
  }
  return {
    distances,
    path(stop){
      const trail=[];
      for(let edge=previous[stop.index];edge;edge=previous[edge.from.index])trail.push(edge);
      return trail.reverse();
    },
  };
}

function roadEdgePoints(edge) {
  if(!edge.road)return [edge.from.point,edge.to.point];
  const a=edge.from.snap,b=edge.to.snap,path=edge.road.paths[a.path];
  const between=a.kilometres<=b.kilometres
    ? path.slice(a.segment+1,b.segment+1)
    : path.slice(b.segment+1,a.segment+1).reverse();
  return [a.point,...between,b.point];
}

if(typeof module!=='undefined') module.exports={buildRoadGraph,routeOldRoads,roadEdgePoints};
