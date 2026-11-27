import math
def xy(p):return [p[0]*90.4,p[1]*111.195]
def project(point,path):
 p=xy(point);best=1e9;along=0;out=None
 for i,(aa,bb) in enumerate(zip(path,path[1:])):
  a,b=xy(aa),xy(bb);dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length**2 or 1)));q=[a[0]+dx*t,a[1]+dy*t];d=math.dist(q,p)
  if d<best:best=d;out={'error':d,'segment':i,'t':t,'along':along+length*t,'point':[aa[0]+(bb[0]-aa[0])*t,aa[1]+(bb[1]-aa[1])*t]}
  along+=length
 return out
