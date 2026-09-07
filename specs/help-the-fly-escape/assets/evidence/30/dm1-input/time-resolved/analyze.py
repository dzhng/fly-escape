from pathlib import Path
import json,gzip,hashlib
import numpy as np
import sys
p=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent
old=json.loads(gzip.decompress((p.parent/'transmission.json.gz').read_bytes()));new=json.loads(gzip.decompress((p/'evidence.json.gz').read_bytes()))
checks=[]
def compare(a,b,path=''):
 if path=='/elapsedSeconds':return
 if isinstance(a,dict):
  assert a.keys()==b.keys(),path
  for k in a:compare(a[k],b[k],path+'/'+k)
 elif isinstance(a,list):
  assert len(a)==len(b),path
  for i,(x,y) in enumerate(zip(a,b)):compare(x,y,path+'/'+str(i))
 else:
  assert a==b,(path,a,b)
  checks.append(path)
compare(old,new)
j=json.loads(gzip.decompress((p/'trace.json.gz').read_bytes()))
manifest=json.loads((p.parent/'manifest.json').read_text())
expected_ids=sum([manifest['pathways'][name] for name in ['OLFACTORY_DN_LEFT','OLFACTORY_DN_RIGHT','FLIGHT_DN_LEFT','FLIGHT_DN_RIGHT']],[])
assert len(expected_ids)==68 and j['indices']==expected_ids and j['turnCount']==50
expected={(seed,side,active,tick) for seed in range(30) for side in [-1,1] for active in [False,True] for tick in range(100)}
seen=set()
assert len(j['traces'])==12000
def ordered_mean(values):
 total=0.
 for value in values:total+=value
 return total/len(values)
for r in j['traces']:
 key=(r['seed'],r['sourceZ'],r['active'],r['tick'])
 assert key in expected and key not in seen,key
 assert isinstance(r['active'],bool) and len(r['voltage'])==68 and len(r['spikes'])==68
 assert all(isinstance(v,bool) for v in r['spikes']) and np.isfinite(r['voltage']).all()
 seen.add(key)
 v=r['voltage'];turn=ordered_mean(v[25:50])-ordered_mean(v[:25])
 flight=(ordered_mean(v[59:68])-ordered_mean(v[50:59]))*.5+turn
 assert r['turn']==turn and r['flightTurn']==flight,key
assert seen==expected
assert j['maximumDecoderError']==0
# Completeness has been proved before allocating/assigning the measurement arrays.
a=np.zeros((30,2,2,100,68));spikes=np.zeros_like(a)
for r in j['traces']:
 side=int(r['sourceZ']>0);arm=int(r['active']);a[r['seed'],side,arm,r['tick']]=r['voltage'];spikes[r['seed'],side,arm,r['tick']]=r['spikes']
delta=a[:,:,1]-a[:,:,0];d=delta[:,1,:,:50]-delta[:,0,:,:50]
w=np.r_[np.full(25,-1/25),np.full(25,1/25)];norm=w@w
projection=(d@w)[:,:,None]*w/norm
signs=2*((np.arange(32768)[:,None]>>np.arange(15))&1)-1

def replication(x):
 train=x[:15].mean(0);test=x[15:].mean(0);v=(x[15:]*train).reshape(15,-1).mean(1)
 score=float(v.mean());null=signs@v/15
 den=np.linalg.norm(train)*np.linalg.norm(test)
 return {'discoveryRms':float(np.sqrt(np.mean(train**2))),'heldOutRms':float(np.sqrt(np.mean(test**2))),'crossHalfMeanProduct':score,'cosine':float(np.sum(train*test)/den) if den else None,'oneSidedExactSignFlipP':float(np.mean(null>=score)),'heldOutPositiveContributions':int((v>0).sum()),'heldOutNegativeContributions':int((v<0).sum())}
def ci(v):
 return {'mean':float(v.mean()),'ci95':(v.mean()+np.array([-1,1])*2.144786688*v.std(ddof=1)/np.sqrt(15)).tolist()}
res={'historicalLeafMatches':len(checks),'uniqueCompleteFrames':len(seen),'maximumDecoderError':j['maximumDecoderError'],'discoverySeeds':[0,14],'heldOutSeeds':[15,29],'directionalVoltage':replication(d),'decoderProjection':replication(projection),'decoderOrthogonalResidual':replication(d-projection),'timeAveragedNeuronPattern':replication(d.mean(1)),'sourceArms':{},'decoderHeldOutMeanDirectionalContrast':ci((d@w)[15:].mean(1)),'directionalSpikes':replication((spikes[:,1,1,:,:50]-spikes[:,1,0,:,:50])-(spikes[:,0,1,:,:50]-spikes[:,0,0,:,:50]))}
for side in [0,1]:res['sourceArms'][str(2*side-1)]=replication(delta[:,side,:,:50])
res['signFlipInterpretation']={'directional':'Held-out seed sign flips exchange mirrored source labels within each active-minus-control contrast; fixed discovery template.', 'sourceArms':'Separate descriptive held-out seed sign flips exchange active/control labels for that source. Not a directional test; symmetry/exchangeability is an assumption.'}
res['checks']={'graphSha256':j['graphSha256'],'manifestSha256':j['manifestSha256']}
(p/'analysis.json').write_text(json.dumps(res,indent=2)+'\n')
print(json.dumps(res,indent=2))
