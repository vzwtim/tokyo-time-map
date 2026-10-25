'use strict';
/* A scalar field is rebuilt in the CURRENT map plane. Its regular grid is never
   forward-warped, so time-space folds cannot make the heatmap overlap itself. */
globalThis.createRentLayer=function(data,stations,lines,xy){
 const sourceById=new Map(data.sources.map(s=>[s.id,s])),byName=new Map();
 for(const r of data.records){const name=data.stationAliases?.[r.name]||r.name;if(!byName.has(name))byName.set(name,r);}
 const observed=stations.map(s=>byName.get(s.name)||null),geos=stations.map(xy);
 const samples=stations.flatMap((s,i)=>observed[i]?[{id:i,geo:geos[i],value:observed[i].rent}]:[]);
 const neighbors=samples.map(s=>stations.filter(t=>t.id!==s.id).map(t=>({id:t.id,d:Math.hypot(geos[t.id][0]-s.geo[0],geos[t.id][1]-s.geo[1])})).filter(t=>t.d>.05).sort((a,b)=>a.d-b.d).slice(0,3));
 const groups=data.sources.flatMap(source=>{const line=lines.find(l=>l.name===source.line);return line?[{source,line,ids:[...new Set(line.stops)]}]:[];});
 function discount(distance){return 1-Math.min(.25,Math.max(0,distance*15.625-10)*.01);}
 function color(value,alpha=1){const t=Math.max(0,Math.min(1,(value-55000)/130000)),a=t<.5?[92,151,141]:[210,195,157],b=t<.5?[210,195,157]:[187,97,72],v=t<.5?t*2:(t-.5)*2;return `rgba(${a.map((x,i)=>Math.round(x+(b[i]-x)*v)).join(',')},${alpha})`;}
 const height=value=>value===null?0:value/20000;
 let field=null,lastKey='',lastBuilt=-Infinity;
 function build(positions,correction=true,resolution=58){
   const placed=samples.map((s,k)=>{const p=positions[s.id],ns=neighbors[k],ratios=ns.map(n=>Math.hypot(positions[n.id][0]-p[0],positions[n.id][1]-p[1])/n.d).sort((a,b)=>a-b),scale=Math.max(.3,Math.min(2.5,ratios[Math.floor(ratios.length/2)]||1));return {...s,p,scale};});
   const buckets=new Map(),bucketSize=6;
   for(const s of placed){const key=Math.floor(s.p[0]/bucketSize)+','+Math.floor(s.p[1]/bucketSize);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(s);}
   function at(p){const bx=Math.floor(p[0]/bucketSize),by=Math.floor(p[1]/bucketSize);let sum=0,weights=0,nearest=Infinity;
    for(let x=bx-1;x<=bx+1;x++)for(let y=by-1;y<=by+1;y++)for(const s of buckets.get(x+','+y)||[]){const dist=Math.hypot(p[0]-s.p[0],p[1]-s.p[1])/s.scale;if(dist<.00001)return {value:s.value,distance:0};if(dist>=2.1)continue;nearest=Math.min(nearest,dist);const weight=Math.pow(1-dist/2.1,2)/(dist*dist+.025);sum+=s.value*weight;weights+=weight;}
    if(!weights)return null;const value=sum/weights;return {value:value*(correction?discount(nearest):1),distance:nearest};
   }
   const minX=Math.min(...placed.map(s=>s.p[0])),maxX=Math.max(...placed.map(s=>s.p[0])),minY=Math.min(...placed.map(s=>s.p[1])),maxY=Math.max(...placed.map(s=>s.p[1]));
   const step=Math.max(.55,Math.sqrt((maxX-minX+8)*(maxY-minY+8))/resolution),keys=new Set();
   for(const s of placed){const r=2.1*s.scale;for(let x=Math.floor((s.p[0]-r)/step);x<=Math.ceil((s.p[0]+r)/step);x++)for(let y=Math.floor((s.p[1]-r)/step);y<=Math.ceil((s.p[1]+r)/step);y++)keys.add(x+','+y);}
   const vertices=[],grid=new Map(),triangles=[],cells=[];
   for(const key of keys){const [x,y]=key.split(',').map(Number),p=[x*step,y*step],v=at(p);if(!v)continue;const vertex={p,value:v.value,height:height(v.value),x,y};vertices.push(vertex);grid.set(key,vertex);}
   for(const a of vertices){const b=grid.get((a.x+1)+','+a.y),c=grid.get(a.x+','+(a.y+1)),d=grid.get((a.x+1)+','+(a.y+1));if(b&&c&&d){cells.push([a,b,d,c]);triangles.push([a,b,c],[b,d,c]);}}
   const x0=Math.min(...vertices.map(v=>v.x)),y0=Math.min(...vertices.map(v=>v.y)),x1=Math.max(...vertices.map(v=>v.x)),y1=Math.max(...vertices.map(v=>v.y));
   function elevation(p){const x=p[0]/step,y=p[1]/step,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;let value=0,w=0;for(const [dx,dy,weight]of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){const v=grid.get((ix+dx)+','+(iy+dy));if(v){value+=v.height*weight;w+=weight;}}return w>0?value/w:0;}
   return {vertices,triangles,cells,at,step,elevation,bounds:[x0,y0,x1,y1],texture:null};
 }
 function prepare(positions,key,now,animating,correction){if(key!==lastKey||!field||(animating&&now-lastBuilt>85)){field=build(positions,correction,animating?42:58);lastKey=key;lastBuilt=now;}return field;}
 function draw(ctx,project,depth,opacity=1){if(!field)return;ctx.save();
   if(depth<.001){
    if(!field.texture){const [x0,y0,x1,y1]=field.bounds,w=x1-x0+1,h=y1-y0+1;let canvas;
     if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(w,h);else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;}
     const context=canvas?.getContext('2d'),pixels=context?.createImageData(w,h);
     if(pixels){for(const v of field.vertices){const k=((v.y-y0)*w+v.x-x0)*4,rgb=color(v.value).match(/[0-9.]+/g);pixels.data[k]=+rgb[0];pixels.data[k+1]=+rgb[1];pixels.data[k+2]=+rgb[2];pixels.data[k+3]=255;}context.putImageData(pixels,0,0);field.texture={canvas,w,h,x:(x0-.5)*field.step,y:(y0-.5)*field.step};}
    }
    if(field.texture){const t=field.texture,a=project([t.x,t.y],0),b=project([t.x+t.w*field.step,t.y],0),c=project([t.x,t.y+t.h*field.step],0);ctx.globalAlpha=.36*opacity;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.transform((b[0]-a[0])/t.w,(b[1]-a[1])/t.w,(c[0]-a[0])/t.h,(c[1]-a[1])/t.h,a[0],a[1]);ctx.drawImage(t.canvas,0,0);}
    else for(const cell of field.cells){ctx.beginPath();cell.forEach((v,i)=>{const p=project(v.p,0);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();ctx.fillStyle=color(cell.reduce((s,v)=>s+v.value,0)/4,.32*opacity);ctx.fill();}
   }else {const sorted=field.triangles.map(t=>({t,coords:t.map(v=>project(v.p,v.height)),sort:t.reduce((s,v)=>s+project(v.p,0)[1],0)})).sort((a,b)=>a.sort-b.sort);
    for(const {t,coords}of sorted){ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=color(t.reduce((s,v)=>s+v.value,0)/3,.63*opacity);ctx.fill();ctx.strokeStyle='#7f91841a';ctx.lineWidth=.45;ctx.stroke();}
   }ctx.restore();
 }

 function compare(eligible){const set=new Set(eligible);return groups.flatMap(g=>{const ids=g.ids.filter(i=>set.has(i)),values=ids.filter(i=>observed[i]).map(i=>observed[i].rent).sort((a,b)=>a-b);if(values.length<3||values.length/ids.length<.5)return [];const n=values.length;return [{name:g.source.name,line:g.line.name,color:g.line.color,median:(values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2,count:n,total:ids.length,ids:ids.filter(i=>observed[i])}];}).sort((a,b)=>a.median-b.median);}
 function profile(name){const line=lines.find(l=>l.name===name);return line?[...new Set(line.stops)].map(id=>({id,name:stations[id].name,rent:observed[id]?.rent??null})):[];}
 return {data,observed,color,height,discount,build,prepare,draw,elevation:p=>field?.elevation(p)||0,compare,profile,groups,source:r=>sourceById.get(r.source),count:observed.filter(Boolean).length};
};
