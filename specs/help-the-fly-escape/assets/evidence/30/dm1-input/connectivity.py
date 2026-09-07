import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,'scripts')
from connectome.artifact import read_binary
from scipy.sparse.csgraph import shortest_path
import numpy as np
root=Path.cwd();matrix=read_binary(root/'data/processed/brain/graph.bin')
manifest=json.loads((root/'specs/help-the-fly-escape/assets/evidence/30/dm1-input/manifest.json').read_text())
groups={g['id']:g['indices'] for g in manifest['groups']}
report={'graphSha256':hashlib.sha256((root/'data/processed/brain/graph.bin').read_bytes()).hexdigest(),'groups':{},'limits':'Directed reachability ignores edge sign and dynamics. Weight sums do not predict neural response or turning. No runtime or graph changes.'}
adjacency=matrix.transpose().tocsr().copy();adjacency.data[:]=1
for source in ['odorInhL','odorInhR','dm1PNL','dm1PNR']:
 sources=groups[source]
 distances=shortest_path(adjacency,directed=True,unweighted=True,indices=sources)
 rows={}
 for target in ['turnL','turnR']:
  targets=groups[target];direct=matrix[targets,:][:,sources]
  hops=np.min(distances[:,targets],axis=0)
  rows[target]={'reachable':int(np.isfinite(hops).sum()),'count':len(targets),'minHopsHistogram':{str(int(h)):int((hops==h).sum()) for h in np.unique(hops) if np.isfinite(h)},'directEdges':direct.nnz,'directPositiveWeight':float(direct.data[direct.data>0].sum()),'directNegativeWeight':float(direct.data[direct.data<0].sum())}
 report['groups'][source]={'count':len(sources),'turnTargets':rows}
print(json.dumps(report,indent=2))
