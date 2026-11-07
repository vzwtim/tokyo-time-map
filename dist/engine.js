const KM_LAT=111.195, KM_LON=90.4;
function xy(p){return [(p.lon-139.7)*KM_LON,(35.69-p.lat)*KM_LAT];}
function km(a,b){return Math.hypot((a.lon-b.lon)*KM_LON,(a.lat-b.lat)*KM_LAT);}
function walkMinutes(a,b){return km(a,b)*1.25/4.8*60;}
class Heap{
 constructor(){this.a=[];} push(x){let a=this.a,i=a.length;a.push(x);while(i){let p=(i-1)>>1;if(a[p][0]<=x[0])break;a[i]=a[p];i=p;}a[i]=x;}
 pop(){let a=this.a,r=a[0],x=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=x[0])break;a[i]=a[c];i=c;}a[i]=x;}return r;}
}
const ROUTING_NETWORK_CACHE=new Map(),ROUTING_RESULT_CACHE=new Map(),WARP_WEIGHT_CACHE=new WeakMap();
let ROUTING_CONNECTORS=null;
function walkingConnectors(){if(ROUTING_CONNECTORS)return ROUTING_CONNECTORS;const edges=STATIONS.map(()=>[]),limit=typeof STATION_COUNT_TOKYO==='undefined'?STATIONS.length:STATION_COUNT_TOKYO;for(let i=0;i<limit;i++)for(let j=i+1;j<limit;j++){const a=STATIONS[i],b=STATIONS[j];if(Math.abs(a.lon-b.lon)>.85/KM_LON||Math.abs(a.lat-b.lat)>.85/KM_LAT)continue;const distance=km(a,b);if(distance<.85){const t=distance*1.25/4.8*60;edges[i].push({to:j,t});edges[j].push({to:i,t});}}if(typeof REGIONAL_WALKS!=='undefined')for(const [a,b,t] of REGIONAL_WALKS){edges[a]=edges[a].filter(e=>e.to!==b);edges[b]=edges[b].filter(e=>e.to!==a);edges[a].push({to:b,t});edges[b].push({to:a,t});}ROUTING_CONNECTORS=edges;return edges;}
function routingNetwork(express,shinkansen){
 const cacheKey=express+':'+shinkansen;
 if(ROUTING_NETWORK_CACHE.has(cacheKey))return ROUTING_NETWORK_CACHE.get(cacheKey);
 const policy=typeof ROUTING_POLICY==='undefined'?{boardingWait:3,transferWalk:5,stationExit:1,stationEntry:2,through:[]}:ROUTING_POLICY;
 const n=STATIONS.length,stride=2+LINES.length*2,adj=Array.from({length:n},()=>[]),through=new Set();
 LINES.forEach((l,li)=>{if((l.express&&!express)||(l.bullet&&!shinkansen))return;
  if(l.edges){for(const edge of l.edges)adj[edge.from].push({...edge,line:li,calibrated:false});return;}
  for(let i=1;i<l.stops.length;i++){
  const a=l.stops[i-1],b=l.stops[i],fallback=km(STATIONS[a],STATIONS[b])/l.speed+.3;
  for(const [from,to,dir] of [[a,b,0],[b,a,1]]){
   const timing=typeof segmentTiming==='function'?segmentTiming(l.name,STATIONS[from].name,STATIONS[to].name):null;
   adj[from].push({to,line:li,dir,run:timing?timing.run:fallback,dwell:timing?timing.dwell:null,calibrated:!!timing});
  }
 }});
 const lineIds=new Map(LINES.map((l,i)=>[l.name,i]));
 for(const [name,a,ad,b,bd] of policy.through){const station=S[name],ai=lineIds.get(a),bi=lineIds.get(b);if(station===undefined||ai===undefined||bi===undefined)throw Error('Invalid through rule '+name);if(!LINES[ai].stops.includes(station)||!LINES[bi].stops.includes(station))throw Error('Disconnected through rule '+name);if(!express&&(LINES[ai].express||LINES[bi].express))continue;through.add(station+':'+ai+':'+ad+'>'+bi+':'+bd);through.add(station+':'+bi+':'+(1-bd)+'>'+ai+':'+(1-ad));}
 // Compile small transfer tables once, outside the shortest-path loop.
 const transfers=STATIONS.map(()=>new Map());if(typeof modeledTransferMinutes==='function')for(let station=0;station<n;station++){const lines=[...new Set(adj[station].map(e=>e.line))];for(const a of lines)for(const b of lines)for(let ad=0;ad<2;ad++)for(let bd=0;bd<2;bd++)transfers[station].set((a*2+ad)*stride+b*2+bd,LINES[a].bullet||LINES[b].bullet
   ? (['東京','名古屋','新大阪'].includes(STATIONS[station].name)?10:7)
   : LINES[a].edges&&LINES[b].edges
     ? (LINES[a].name.split(' ')[0]===LINES[b].name.split(' ')[0]?4:6)
     : modeledTransferMinutes(station,a,b,ad,bd));}
 const connectors=walkingConnectors();
 const network={n,stride,adj,connectors,through,policy,transfers};ROUTING_NETWORK_CACHE.set(cacheKey,network);return network;
}
function calculate(origin,mode='rail',express=true,shinkansen=true){
 const cacheKey=origin+':'+mode+':'+express+':'+shinkansen;
 if(ROUTING_RESULT_CACHE.has(cacheKey)){const result=ROUTING_RESULT_CACHE.get(cacheKey);ROUTING_RESULT_CACHE.delete(cacheKey);ROUTING_RESULT_CACHE.set(cacheKey,result);return result;}
 const {n,stride,adj,connectors,through,policy,transfers}=routingNetwork(express,shinkansen);
 const states=new Map(),heap=new Heap(),best=STATIONS.map((_,i)=>({time:Infinity,key:i*stride}));
 function relax(key,t,previous,event){
  if(t+1e-8>=(states.get(key)?.time??Infinity))return;
  const step={time:t,previous,event};states.set(key,step);heap.push([t,key,step]);
  const station=Math.floor(key/stride);
  if(t<best[station].time)best[station]={time:t,key};
 }
 // State 0: before the first boarding. State 1: on foot after a train ride.
 // Remaining states retain the line AND direction of the current train.
 for(let i=0;i<n;i++){
  const t=walkMinutes(STATIONS[origin],STATIONS[i]);
  const tokyoPair=typeof STATION_COUNT_TOKYO==='undefined'||(origin<STATION_COUNT_TOKYO&&i<STATION_COUNT_TOKYO);
  if(mode==='rail'&&!tokyoPair&&t>15)continue;
  relax(i*stride,t,null,{type:'walk',from:origin,to:i,t});
 }
 if(mode==='rail')while(heap.a.length){const [t,key,step]=heap.pop();if(states.get(key)!==step)continue;const station=Math.floor(key/stride),state=key%stride,onTrain=state>=2,lastLine=onTrain?Math.floor((state-2)/2):-1,lastDir=onTrain?(state-2)%2:-1;
  for(const e of adj[station]){const same=onTrain&&lastLine===e.line&&lastDir===e.dir;
   const direct=onTrain&&!same&&through.has(station+':'+lastLine+':'+lastDir+'>'+e.line+':'+e.dir);
   const board=!(same||direct),transfer=board&&(onTrain||state===1),boardWait=board?(transfer?(LINES[e.line].wait??policy.boardingWait):(policy.initialBoardingWait??policy.boardingWait)):0,transferTime=transfer?(onTrain?(transfers[station].get((lastLine*2+lastDir)*stride+e.line*2+e.dir)??policy.transferWalk):policy.stationEntry):0;
   // Dwell belongs to a departure while staying on the train, never to the final arrival.
   const dwell=board?0:(e.dwell??LINES[lastLine].dwell??(LINES[lastLine].express?.6:.4)),ride=e.run+dwell,wait=boardWait+transferTime,next=e.to*stride+2+e.line*2+e.dir;
   relax(next,t+ride+wait,step,{type:'rail',from:station,to:e.to,line:e.line,direction:e.dir,t:ride,run:e.run,dwell,wait,boardWait,transferTime,transfer,through:direct,boarding:board,calibrated:e.calibrated});
  }
  if(onTrain)for(const e of connectors[station])relax(e.to*stride+1,t+e.t+policy.stationExit,step,{type:'walk',from:station,to:e.to,t:e.t+policy.stationExit,exit:policy.stationExit});
 }
 const paths=new Map(),summaries=new Map();
 function route(id){
  if(paths.has(id))return paths.get(id);
  const steps=[];
  for(let step=states.get(best[id].key);step;step=step.previous)if(step.event.t+(step.event.wait||0)>1e-8)steps.push(step.event);
  steps.reverse();paths.set(id,steps);return steps;
 }
 function summary(id){if(summaries.has(id))return summaries.get(id);const value={ride:0,walk:0,boardingWait:0,transferWalk:0,transfers:0,through:0};for(const e of route(id)){if(e.type==='rail'){value.ride+=e.t;value.boardingWait+=e.boardWait;value.transferWalk+=e.transferTime;if(e.transfer)value.transfers++;if(e.through)value.through++;}else value.walk+=e.t;}value.total=value.ride+value.walk+value.boardingWait+value.transferWalk;summaries.set(id,value);return value;}
 const result={origin,mode,express,best,route,summary};ROUTING_RESULT_CACHE.set(cacheKey,result);if(ROUTING_RESULT_CACHE.size>8)ROUTING_RESULT_CACHE.delete(ROUTING_RESULT_CACHE.keys().next().value);return result;
}
// All origins share the same geographic anchor positions. Use a grid so a
// national coastline does not require a full station scan for every vertex.
let warpAnchorGrid=null;
const WARP_CELL=12;
function anchorWeights(p,anchors){
 let weights=WARP_WEIGHT_CACHE.get(p);
 if(weights)return weights;
 if(!warpAnchorGrid){
  warpAnchorGrid=new Map();
  anchors.forEach(({p},i)=>{
   const key=Math.floor(p[0]/WARP_CELL)+':'+Math.floor(p[1]/WARP_CELL);
   if(!warpAnchorGrid.has(key))warpAnchorGrid.set(key,[]);
   warpAnchorGrid.get(key).push(i);
  });
 }
 const nearest=[];
 function consider(k){
  const q=anchors[k].p,d=(p[0]-q[0])**2+(p[1]-q[1])**2;
  if(nearest.length===7&&d>=nearest[6][0])return;
  let i=nearest.length;
  while(i>0&&nearest[i-1][0]>d)i--;
  nearest.splice(i,0,[d,k]);if(nearest.length>7)nearest.pop();
 }
 const x=Math.floor(p[0]/WARP_CELL),y=Math.floor(p[1]/WARP_CELL);
 for(let ring=0;ring<=8;ring++){
  for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==ring)continue;
   for(const k of warpAnchorGrid.get((x+dx)+':'+(y+dy))??[])consider(k);
  }
  const outside=Math.min(p[0]-(x-ring)*WARP_CELL,(x+ring+1)*WARP_CELL-p[0],
   p[1]-(y-ring)*WARP_CELL,(y+ring+1)*WARP_CELL-p[1]);
  if(nearest.length===7&&nearest[6][0]<outside**2)break;
  if(ring===8){nearest.length=0;for(let k=0;k<anchors.length;k++)consider(k);}
 }
 if(nearest[0][0]<1e-10)weights=[[nearest[0][1],1]];
 else{
  let sum=0;
  weights=nearest.map(([d,k])=>{const w=1/(d**1.4+.00001);sum+=w;return [k,w];});
  weights.forEach(row=>row[1]/=sum);
 }
 WARP_WEIGHT_CACHE.set(p,weights);return weights;
}
function makeWarp(origin,result){
 const base=xy(STATIONS[origin]),anchors=STATIONS.map((s,i)=>{
  const p=xy(s),d=Math.hypot(p[0]-base[0],p[1]-base[1]),t=result.best[i].time;
  return {p,reachable:Number.isFinite(t),ratio:i===origin||d<1e-8||!Number.isFinite(t)?1:t*.353/d};
 });
 const move=(p,r)=>[base[0]+(p[0]-base[0])*r,base[1]+(p[1]-base[1])*r];
 return {base,anchors,point(p){
  const weights=anchorWeights(p,anchors);
  let sum=0,total=0;
  for(const [i,w] of weights){
   if(!anchors[i].reachable)continue;
   sum+=anchors[i].ratio*w;total+=w;
  }
  return move(p,total?sum/total:1);
 },station(i){const a=anchors[i];return move(a.p,a.ratio);}};
}
if(typeof module!=='undefined')module.exports={xy,km,walkMinutes,Heap,calculate,makeWarp};
