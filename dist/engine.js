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
function walkingConnectors(){if(ROUTING_CONNECTORS)return ROUTING_CONNECTORS;const edges=STATIONS.map(()=>[]);for(let i=0;i<STATIONS.length;i++)for(let j=i+1;j<STATIONS.length;j++){const a=STATIONS[i],b=STATIONS[j];if(Math.abs(a.lon-b.lon)>.85/KM_LON||Math.abs(a.lat-b.lat)>.85/KM_LAT)continue;const distance=km(a,b);if(distance<.85){const t=distance*1.25/4.8*60;edges[i].push({to:j,t});edges[j].push({to:i,t});}}ROUTING_CONNECTORS=edges;return edges;}
function routingNetwork(express){
 if(ROUTING_NETWORK_CACHE.has(express))return ROUTING_NETWORK_CACHE.get(express);
 const policy=typeof ROUTING_POLICY==='undefined'?{boardingWait:3,transferWalk:5,stationExit:1,stationEntry:2,through:[]}:ROUTING_POLICY;
 const n=STATIONS.length,stride=2+LINES.length*2,adj=Array.from({length:n},()=>[]),through=new Set();
 LINES.forEach((l,li)=>{if(l.express&&!express)return;for(let i=1;i<l.stops.length;i++){const a=l.stops[i-1],b=l.stops[i],run=km(STATIONS[a],STATIONS[b])/l.speed+.3;adj[a].push({to:b,line:li,dir:0,run});adj[b].push({to:a,line:li,dir:1,run});}});
 const lineIds=new Map(LINES.map((l,i)=>[l.name,i]));
 for(const [name,a,ad,b,bd] of policy.through){const station=S[name],ai=lineIds.get(a),bi=lineIds.get(b);if(station===undefined||ai===undefined||bi===undefined)throw Error('Invalid through rule '+name);if(!LINES[ai].stops.includes(station)||!LINES[bi].stops.includes(station))throw Error('Disconnected through rule '+name);if(!express&&(LINES[ai].express||LINES[bi].express))continue;through.add(station+':'+ai+':'+ad+'>'+bi+':'+bd);through.add(station+':'+bi+':'+(1-bd)+'>'+ai+':'+(1-ad));}
 // Compile small transfer tables once, outside the shortest-path loop.
 const transfers=STATIONS.map(()=>new Map());if(typeof modeledTransferMinutes==='function')for(let station=0;station<n;station++){const lines=[...new Set(adj[station].map(e=>e.line))];for(const a of lines)for(const b of lines)for(let ad=0;ad<2;ad++)for(let bd=0;bd<2;bd++)transfers[station].set((a*2+ad)*stride+b*2+bd,modeledTransferMinutes(station,a,b,ad,bd));}
 const connectors=walkingConnectors();
 const network={n,stride,adj,connectors,through,policy,transfers};ROUTING_NETWORK_CACHE.set(express,network);return network;
}
function calculate(origin,mode='rail',express=true){
 const cacheKey=origin+':'+mode+':'+express;
 if(ROUTING_RESULT_CACHE.has(cacheKey)){const result=ROUTING_RESULT_CACHE.get(cacheKey);ROUTING_RESULT_CACHE.delete(cacheKey);ROUTING_RESULT_CACHE.set(cacheKey,result);return result;}
 const net=routingNetwork(express),{n,stride,adj,connectors,through,policy,transfers}=net,size=n*stride;
 const times=new Float64Array(size).fill(Infinity),prev=new Int32Array(size).fill(-1),events=new Array(size),heap=new Heap();
 function relax(key,t,p,event){if(t+1e-8<times[key]){times[key]=t;prev[key]=p;events[key]=event;heap.push([t,key]);}}
 // State 0: before the first boarding. State 1: on foot after a train ride.
 // Remaining states retain the line AND direction of the current train.
 for(let i=0;i<n;i++){const t=walkMinutes(STATIONS[origin],STATIONS[i]);relax(i*stride,t,-1,{type:'walk',from:origin,to:i,t});}
 if(mode==='rail')while(heap.a.length){const [t,key]=heap.pop();if(t>times[key]+1e-8)continue;const station=Math.floor(key/stride),state=key%stride,onTrain=state>=2,lastLine=onTrain?Math.floor((state-2)/2):-1,lastDir=onTrain?(state-2)%2:-1;
  for(const e of adj[station]){const same=onTrain&&lastLine===e.line&&lastDir===e.dir;
   const direct=onTrain&&!same&&through.has(station+':'+lastLine+':'+lastDir+'>'+e.line+':'+e.dir);
   const board=!(same||direct),transfer=board&&(onTrain||state===1),boardWait=board?policy.boardingWait:0,transferTime=transfer?(onTrain?(transfers[station].get((lastLine*2+lastDir)*stride+e.line*2+e.dir)??policy.transferWalk):policy.stationEntry):0;
   // Dwell belongs to a departure while staying on the train, never to the final arrival.
   const dwell=board?0:(LINES[lastLine].express?.6:.4),ride=e.run+dwell,wait=boardWait+transferTime,next=e.to*stride+2+e.line*2+e.dir;
   relax(next,t+ride+wait,key,{type:'rail',from:station,to:e.to,line:e.line,direction:e.dir,t:ride,run:e.run,dwell,wait,boardWait,transferTime,transfer,through:direct,boarding:board});
  }
  if(onTrain)for(const e of connectors[station])relax(e.to*stride+1,t+e.t+policy.stationExit,key,{type:'walk',from:station,to:e.to,t:e.t+policy.stationExit,exit:policy.stationExit});
 }
 const best=STATIONS.map((s,i)=>{let k=i*stride;for(let j=1;j<stride;j++)if(times[i*stride+j]<times[k])k=i*stride+j;return {time:times[k],key:k};});
 const paths=new Map(),summaries=new Map();
 function route(id){if(paths.has(id))return paths.get(id);let k=best[id].key,steps=[],guard=0;while(k>=0&&guard++<size){if(events[k]&&events[k].t+(events[k].wait||0)>1e-8)steps.push(events[k]);k=prev[k];}steps.reverse();paths.set(id,steps);return steps;}
 function summary(id){if(summaries.has(id))return summaries.get(id);const value={ride:0,walk:0,boardingWait:0,transferWalk:0,transfers:0,through:0};for(const e of route(id)){if(e.type==='rail'){value.ride+=e.t;value.boardingWait+=e.boardWait;value.transferWalk+=e.transferTime;if(e.transfer)value.transfers++;if(e.through)value.through++;}else value.walk+=e.t;}value.total=value.ride+value.walk+value.boardingWait+value.transferWalk;summaries.set(id,value);return value;}
 const result={origin,mode,express,best,route,summary};ROUTING_RESULT_CACHE.set(cacheKey,result);if(ROUTING_RESULT_CACHE.size>8)ROUTING_RESULT_CACHE.delete(ROUTING_RESULT_CACHE.keys().next().value);return result;
}
function makeWarp(origin,result){const base=xy(STATIONS[origin]), anchors=STATIONS.map((s,i)=>{let p=xy(s),d=Math.hypot(p[0]-base[0],p[1]-base[1]);return {p,ratio:i===origin?1:result.best[i].time*.353/d};});
 function ratio(p){let weights=WARP_WEIGHT_CACHE.get(p);if(!weights){const nearest=[];for(let k=0;k<anchors.length;k++){const a=anchors[k],d=(p[0]-a.p[0])**2+(p[1]-a.p[1])**2;if(d<1e-10){weights=[[k,1]];break;}if(nearest.length===7&&d>=nearest[6][0])continue;let i=nearest.length;while(i>0&&nearest[i-1][0]>d)i--;nearest.splice(i,0,[d,k]);if(nearest.length>7)nearest.pop();}if(!weights){let sum=0;weights=nearest.map(([d,k])=>{const w=1/(d**1.4+.00001);sum+=w;return [k,w];});weights.forEach(row=>row[1]/=sum);}WARP_WEIGHT_CACHE.set(p,weights);}let result=0;for(const [index,weight] of weights)result+=anchors[index].ratio*weight;return result;}

 return {base,anchors,point(p){const r=ratio(p);return [base[0]+(p[0]-base[0])*r,base[1]+(p[1]-base[1])*r];},station(i){let p=anchors[i].p,r=anchors[i].ratio;return [base[0]+(p[0]-base[0])*r,base[1]+(p[1]-base[1])*r];}};
}
if(typeof module!=='undefined')module.exports={xy,km,walkMinutes,Heap,calculate,makeWarp};
