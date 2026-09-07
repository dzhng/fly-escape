"""Reproduce inclusive attribution for this recorded static-bundle profile."""
from pathlib import Path
import json
p=Path(__file__).resolve().parent
profile=json.loads((p/'profile.cpuprofile').read_text())
nodes={n['id']:n for n in profile['nodes']}
regions={
 'posePreparation':('xm',None,None),
 'wasmMotionSample':('sampleMotion',0,22074),
 'trailHistoryConversion':('Op',None,None),
 'trailGeometrySample':('sample',4107,2000443),
 'setPosesIncludingAnimationGuard':('setPoses',4130,6385),
 'worldRenderInclusive':('render',4130,11999),
 'threeRenderInclusive':('Jd.render',4107,31649),
 'shadowRenderInclusive':('Nd.render',4083,729),
 'furnitureCutaway':('cp',None,None),
}
results={}
for label,(name,line,col) in regions.items():
 roots=[n['id'] for n in nodes.values() if n['callFrame']['functionName']==name and
        (line is None or n['callFrame']['lineNumber']==line) and
        (col is None or n['callFrame']['columnNumber']==col)]
 assert roots,label
 included=set(roots);pending=list(roots)
 while pending:
  for child in nodes[pending.pop()].get('children',[]):
   if child not in included:included.add(child);pending.append(child)
 samples=[dt for n,dt in zip(profile['samples'],profile['timeDeltas']) if n in included]
 results[label]={'samples':len(samples),'inclusiveMs':sum(samples)/1000}
expected=json.loads((p/'attribution.json').read_text())
for key,value in results.items():assert expected[key]==value,(key,value,expected[key])
print(json.dumps(results,indent=2))
