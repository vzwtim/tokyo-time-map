"""Rebuild audited map linework from a pinned source revision and reviewed corrections.

Run from the repo root: python tools/repair-old-roads.py
Official post coordinates remain unchanged. Only schematic road lines are fitted.
Additional non-post places retain their classification and source in field 6.
"""
import bisect,json,math,subprocess,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'road-data'))
from geometry import project,xy
BASE='cea555abcc69e6a0328a4883df8206a38a056c9f'
ROOT=Path(__file__).resolve().parent.parent
repairs=json.loads((ROOT/'tools/road-data/repairs.json').read_text())
def original(file):return json.loads(subprocess.check_output(['git','show',BASE+':dist/'+file],cwd=ROOT))
raw=original('old-roads.json');extra=original('old-roads-extra.json');roads={}
for rid,name,paths,stops in raw+extra:
 key=rid.split('-')[0]
 row=roads.setdefault(key,[key,name,[],[]]);row[2]+=paths;row[3]+=stops
for row in roads.values():
 seen=set();row[3]=[s for s in row[3] if not((key:=(s[5],s[3],s[4])) in seen or seen.add(key))]
def nearest(point,paths):return min((dict(project(point,p),path=i) for i,p in enumerate(paths)),key=lambda q:q['error'])
def km(a,b):
 lat=(a[1]+b[1])/2*math.pi/180
 return math.hypot((a[0]-b[0])*111.195*math.cos(lat),(a[1]-b[1])*111.195)
def get(rid,name):return next(s for s in roads[rid][3] if s[0]==name)
def status(row):
 return [{'name':s[0],'hub':s[5],'offsetKm':round((q:=nearest(s[3:5],row[2]))['error'],4),'path':q['path']} for s in row[3]]
before={rid:status(row) for rid,row in roads.items()}
all_stops=[s for r in roads.values() for s in r[3]]
for rid,stops in repairs['additions'].items():
 for s in stops:
  near=next((old for old in all_stops if old[0]==s[0] and km(old[3:5],s[3:5])<3),None)
  if near:s=[*near[:6],s[6]]
  if not any(old[0]==s[0] and km(old[3:5],s[3:5])<1 for old in roads[rid][3]):roads[rid][3].append(s)
# Preserve exact geometry of an already-mapped shared corridor.
for spec in repairs['shared']:
 row=roads[spec['road']];source=roads[spec['sourceRoad']]
 a=get(spec['road'],spec['from'])[3:5]
 b=spec.get('toPoint') or get(spec['road'],spec['to'])[3:5]
 choices=[]
 for p in source[2]:
  aa,bb=project(a,p),project(b,p);choices.append((aa['error']+bb['error'],p,aa,bb))
 _,p,aa,bb=min(choices,key=lambda x:x[0]);lo,hi=sorted([aa,bb],key=lambda q:q['along'])
 part=[a]+p[lo['segment']+1:hi['segment']+1]+[b]
 if aa['along']>bb['along']:part=[a]+list(reversed(p[lo['segment']+1:hi['segment']+1]))+[b]
 row[2].append(part)
for spec in repairs['links']:
 roads[spec['road']][2].append([get(spec['road'],n)[3:5] for n in spec['names']])
# Source-preserving local cartographic fit. Each post is an exact anchor; offsets
# fade to zero on both sides, so unrelated coastline/road geometry never moves.
for rid,row in roads.items():
 assignments=[nearest(s[3:5],row[2]) for s in row[3]]
 fitted=[]
 for pi,path in enumerate(row[2]):
  cumulative=[0.]
  for a,b in zip(path,path[1:]):cumulative.append(cumulative[-1]+math.dist(xy(a),xy(b)))
  length=cumulative[-1];anchors=[]
  for s,q in zip(row[3],assignments):
   local=project(s[3:5],path)
   endpoint=local['t']<.000001 and local['segment']==0 or local['t']>.999999 and local['segment']==len(path)-2
   if q['path']==pi and q['error']<=3.5 or local['error']<=.15 or endpoint and local['error']<=1:
    anchors.append((local['along'],s[3:5],local))
  anchors.sort(key=lambda a:a[0]);knots=[(0.,[0.,0.]),(length,[0.,0.])]
  for i,(at,target,q) in enumerate(anchors):
   radius=max(.35,q['error']*3)
   left=(at-anchors[i-1][0])*.45 if i else at
   right=(anchors[i+1][0]-at)*.45 if i+1<len(anchors) else length-at
   if min(radius,left)>.00001:knots.append((at-min(radius,left),[0.,0.]))
   if min(radius,right)>.00001:knots.append((at+min(radius,right),[0.,0.]))
   knots.append((at,[target[0]-q['point'][0],target[1]-q['point'][1]]))
  # Later hard anchors take precedence over zero end/support knots.
  unique={round(t,9):(t,delta) for t,delta in knots};knots=sorted(unique.values());positions=[k[0] for k in knots]
  def shifted(at,point):
   i=max(0,min(len(knots)-2,bisect.bisect_right(positions,at)-1));a,da=knots[i];b,db=knots[i+1];t=(at-a)/(b-a or 1)
   return [round(point[j]+da[j]*(1-t)+db[j]*t,6) for j in range(2)]
  vertices=[(at,shifted(at,point),0) for at,point in zip(cumulative,path)]
  vertices +=[(at,target,1) for at,target,q in anchors]
  vertices.sort(key=lambda v:(v[0],v[2]));result=[]
  for at,point,hard in vertices:
   if result and abs(at-result[-1][0])<1e-7:result[-1]=(at,point)
   else:result.append((at,point))
  fitted.append([p for _,p in result])
 row[2]=fitted
# The source line ends short of a documented terminus or bypasses its town.
for spec in repairs.get('endConnections',[]):
 row=roads[spec['road']];stop=get(spec['road'],spec['name']);q=nearest(stop[3:5],row[2])
 row[2].append([q['point'],stop[3:5]])
# Keep supplemental roads in their existing lazy-load file.
main=[r for rid,r in roads.items() if rid not in ['R222','R312']]
supplement=[roads[rid] for rid in ['R222','R312']]
for file,data in [('old-roads.json',main),('old-roads-extra.json',supplement)]:
 (ROOT/'dist'/file).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
audit={'base':BASE,'sources':repairs['sources'],'roads':[]}
for rid,row in roads.items():
 after=status(row);audit['roads'].append({'id':rid,'name':row[1],'postsBefore':len(before[rid]),'pointsAfter':len(row[3]),'before':before[rid],'after':after})
(ROOT/'dist/old-roads-audit.json').write_text(json.dumps(audit,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'roads':len(roads),'points':sum(len(r[3]) for r in roads.values()),'previousOffsetOver150m':sum(s['offsetKm']>.15 for v in before.values() for s in v),'remainingOffsetOver10m':[(r['name'],s['name'],s['offsetKm']) for r in audit['roads'] for s in r['after'] if s['offsetKm']>.01]},ensure_ascii=False))
