"""Display proposed RGB bytes only; no response figures or experiment results."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
import numpy as np

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
p=json.loads((HERE/'proposal.json').read_bytes())
m=json.loads((ROOT/'specs/retinal-vision/assets/05/retinal-map.json').read_bytes())
cells=m['profile']['layout']['cells'];centres=np.asarray([[c['x'],c['y']] for c in cells])
angles=np.arange(6)*np.pi/3+np.pi/6
polygons=centres[:,None,:]+.56*np.stack([np.cos(angles),np.sin(angles)],axis=1)[None,:,:]
selected=[('08',n) for n in ['Lupper','Rupper','Llower','Rlower']]+[('09',n) for n in ['color-1-a','color-1-b','color-2-a','color-2-b']]
fig=plt.figure(figsize=(16,9),layout='constrained');grid=fig.add_gridspec(2,4)
for i,(panel,name) in enumerate(selected):
 spec=next(c for c in p['panels'][panel]['conditions'] if c['name']==name)
 raw=(HERE/spec['rgbPath']).read_bytes();rgb=np.frombuffer(raw,dtype=np.uint8).reshape(2,721,3)/255
 display=np.where(rgb<=.0031308,12.92*rgb,1.055*rgb**(1/2.4)-.055)
 sub=grid[i//4,i%4].subgridspec(2,2,height_ratios=[.18,1])
 title=fig.add_subplot(sub[0,:]);title.axis('off');title.text(.5,.5,name,ha='center',weight='bold')
 for eye in [0,1]:
  ax=fig.add_subplot(sub[1,eye]);ax.add_collection(PolyCollection(polygons,facecolors=display[eye],edgecolors='#666',linewidths=.15))
  ax.set_xlim(-16,16);ax.set_ylim(14.5,-14.5);ax.set_aspect('equal');ax.axis('off');ax.set_title(['Left','Right'][eye],fontsize=9)
fig.suptitle('INPUT-ONLY PROPOSAL — no neural run\n32 jointly supported samples per patch; original anchors and image axes retained. Both eyes: right/down, neither mirrored.\nTop: gray 128, Tm20 off. Bottom: matched-brightness A/B swaps; higher level adds 100 to R/G while holding B fixed.\nStored linear RGB8 displayed through sRGB transfer. Exact indices, colors, currents and controls: proposal.json / evidence.json.',fontsize=12)
fig.savefig(HERE/'proposed-inputs.png',dpi=160);plt.close(fig)
