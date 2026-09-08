import json,struct,re,hashlib,sys
from functools import lru_cache
from pathlib import Path

def read(path):
 b=Path(path).read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);data=b[28+n:]
 @lru_cache(None)
 def acc(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];types={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'};counts={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};fmt='<'+types[a['componentType']]*counts[a['type']];size=struct.calcsize(fmt);offset=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from(fmt,data,offset+k*v.get('byteStride',size)) for k in range(a['count'])]
 name=lambda i:re.sub(r'\.\d+$','',j['nodes'][i]['name'])
 shapes={}
 for i,node in enumerate(j['nodes']):
  if 'mesh' not in node:continue
  for p in j['meshes'][node['mesh']]['primitives']:
   indices=[v[0] for v in acc(p['indices'])];attrs={k:[acc(v)[idx] for idx in indices] for k,v in p['attributes'].items()};shapes[name(i)]=attrs
 animations={a['name']:[(name(c['target']['node']),c['target']['path'],acc(a['samplers'][c['sampler']]['input']),acc(a['samplers'][c['sampler']]['output'])) for c in a['channels']] for a in j['animations']}
 nodes={name(i):{k:v for k,v in node.items() if k not in ['name','mesh','children','skin']}|{'children':[name(c) for c in node.get('children',[])]} for i,node in enumerate(j['nodes'])}
 skins=[{'joints':[name(i) for i in skin['joints']],'inverseBindMatrices':acc(skin['inverseBindMatrices'])} for skin in j['skins']]
 return b,j,shapes,animations,nodes,skins

def canonical(attrs,keys):
 rows=[tuple(attrs[k][i] for k in keys) for i in range(len(attrs['POSITION']))]
 return sorted(min(tuple(rows[i:i+3][j:]+rows[i:i+3][:j]) for j in range(3)) for i in range(0,len(rows),3))

old,new=map(read,sys.argv[1:3])
assert old[2].keys()==new[2].keys()
assert old[3:]==new[3:], 'Rig, clips or node transforms changed'
assert all(canonical(old[2][n],['POSITION','JOINTS_0','WEIGHTS_0'])==canonical(new[2][n],['POSITION','JOINTS_0','WEIGHTS_0']) for n in old[2]), 'Physical triangles or skin weights changed'
assert [{k:v for k,v in m.items() if k!='name'} for m in old[1]['materials']]==[{k:v for k,v in m.items() if k!='name'} for m in new[1]['materials']], 'Material changed'
print('Exact oriented physical triangles, weights, rig, clips and materials preserved.')
