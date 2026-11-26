'use strict';

const roadDistance = (a,b) => {
  const latitude = (35.69 - (a[1]+b[1])/(2*KM_LAT)) * Math.PI/180;
  return Math.hypot((a[0]-b[0]) * KM_LAT/KM_LON * Math.cos(latitude),a[1]-b[1]);
};

// Multipart roads and their named branches share their post-town inventory.
function mergeRoadEntries(entries) {
  const merged=new Map();
  for(const [id,name,paths,stops] of entries){
    const key=id.replace(/-\d+$/, '');
    const road=merged.get(key)??[key,name,[],[]];
    road[2].push(...paths);road[3].push(...stops);
    merged.set(key,road);
  }
  for(const road of merged.values()){
    const seen=new Set();
    road[3]=road[3].filter(stop=>{
      const key=stop[5]+':'+stop[3]+':'+stop[4];
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }
  return [...merged.values()];
}

function buildRoadGraph(roads) {
  const stops=[], nodes=[], groups=new Map(), edges=[], paths=[];
  const addNode=node=>{node.index=nodes.length;nodes.push(node);edges.push([]);return node;};
  const link=(a,b,road,distance)=>{
    if(a===b)return;
    edges[a.index].push({from:a,to:b,road,distance});
    edges[b.index].push({from:b,to:a,road,distance});
  };
  const project=(point,entry)=>{
    let best=Infinity,snap;
    const path=entry.points;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.min(1,Math.max(0,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
      const projected=[a[0]+dx*t,a[1]+dy*t],error=roadDistance(point,projected);
      if(error>=best)continue;
      best=error;
      snap={path:entry.index,segment:i-1,point:projected,kilometres:entry.lengths[i-1]+(entry.lengths[i]-entry.lengths[i-1])*t};
    }
    return {error:best,snap};
  };
  for(const road of roads){
    road.stopsByPath=road.paths.map(()=>[]);
    road.routingPaths=road.paths.map((points,index)=>{
      const lengths=[0];
      for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+roadDistance(points[i-1],points[i]));
      const box=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
      const entry={road,index,points,lengths,box,nodes:[]};paths.push(entry);return entry;
    });
    for(const stop of road.stops){
      addNode(stop);stop.road=road;stops.push(stop);
      if(!groups.has(stop.hub))groups.set(stop.hub,[]);
      groups.get(stop.hub).push(stop);
      let best={error:Infinity};
      for(const entry of road.routingPaths){
        const candidate=project(stop.point,entry);
        if(candidate.error<best.error)best=candidate;
      }
      stop.snap=best.error<=3.5?best.snap:null;
      if(stop.snap){
        road.stopsByPath[stop.snap.path].push(stop);
        road.routingPaths[stop.snap.path].nodes.push(stop);
      }
    }
    for(const list of road.stopsByPath)list.sort((a,b)=>a.snap.kilometres-b.snap.kilometres);
  }
  // Join actual line endpoints to nearby linework, including branches without posts.
  // 200 m accommodates the simplified source geometry, without bridging water gaps.
  const junction=(entry,snap)=>{
    const existing=entry.nodes.find(node=>Math.abs(node.snap.kilometres-snap.kilometres)<.001);
    if(existing)return existing;
    const nearest=entry.road.stops.filter(stop=>stop.snap).sort((a,b)=>roadDistance(a.point,snap.point)-roadDistance(b.point,snap.point))[0];
    const name=nearest&&roadDistance(nearest.point,snap.point)<1?nearest.name:'街道の分岐';
    const node=addNode({name,point:snap.point,snap,road:entry.road,junction:true});
    entry.nodes.push(node);return node;
  };
  for(const entry of paths){
    if(entry.points.length<2)continue;
    for(const endpoint of [entry.points[0],entry.points.at(-1)]){
      const own=project(endpoint,entry).snap;
      for(const other of paths){
        if(other===entry)continue;
        const [x,y]=endpoint,b=other.box;
        if(x<b[0]-.4||x>b[2]+.4||y<b[1]-.4||y>b[3]+.4)continue;
        const candidate=project(endpoint,other);
        if(candidate.error>.2)continue;
        const from=junction(entry,own),to=junction(other,candidate.snap);
        link(from,to,null,roadDistance(from.snap.point,to.snap.point));
      }
    }
  }
  for(const entry of paths){
    entry.nodes.sort((a,b)=>a.snap.kilometres-b.snap.kilometres);
    for(let i=1;i<entry.nodes.length;i++)link(entry.nodes[i-1],entry.nodes[i],entry.road,entry.nodes[i].snap.kilometres-entry.nodes[i-1].snap.kilometres);
  }
  for(const members of groups.values())for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
    const distance=roadDistance(members[i].point,members[j].point);
    if(distance<1)link(members[i],members[j],null,distance);
  }
  return {stops,nodes,groups,edges};
}

function routeOldRoads(graph, origin) {
  const costs = new Float64Array(graph.nodes.length).fill(Infinity);
  const distances = new Float64Array(graph.nodes.length).fill(Infinity);
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

if(typeof module!=='undefined') module.exports={mergeRoadEntries,buildRoadGraph,routeOldRoads,roadEdgePoints};
