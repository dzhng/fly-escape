"""Verify and summarize native adapter outputs without reading or running neural responses."""
import hashlib
import json
import math
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
def sha(raw): return hashlib.sha256(raw).hexdigest()
def dump(path,value): path.write_text(json.dumps(value,indent=2,sort_keys=True)+'\n')

proposal=json.loads((HERE/'proposal.json').read_bytes())
native=json.loads((HERE/'currents.json').read_bytes())
mapping=json.loads((ROOT/'specs/done/retinal-vision/assets/05/retinal-map.json').read_bytes())
entries=mapping['entries']
assert native['proposalHash']==sha((HERE/'proposal.json').read_bytes())
assert native['mapHash']==proposal['mapSha256']
assert native['helperSourceHash']==sha((HERE/'native/src/main.rs').read_bytes())
assert native['adapterSourceHash']==sha((ROOT/'crates/sim/src/sensory.rs').read_bytes())
assert proposal['proposedSeeds']==list(range(200,230)) and not set(proposal['proposedSeeds'])&set(proposal['seedsUsedPreviously'])
assert len(proposal['endpoints'])==438 and proposal['gain']==3 and not proposal['runAuthorized']

def values(condition,kind='effective'):return [v for _,v in condition[kind]]
def dose(v):
    return dict(total=sum(v), maximum=max(v), stimulatedInputCount=sum(x!=0 for x in v),
        byEyeChannel={eye+str(channel):sum(x for e,x in zip(entries,v) if e['eye']==eye and e['channel']==channel) for eye in ['L','R'] for channel in [0,1]},
        stimulatedByEyeChannel={eye+str(channel):sum(x!=0 for e,x in zip(entries,v) if e['eye']==eye and e['channel']==channel) for eye in ['L','R'] for channel in [0,1]})

panels={}
for slice_id,pack in proposal['panels'].items():
    conditions={v['name']:v for v in native['panels'][slice_id]}
    assert list(conditions)==[v['name'] for v in pack['conditions']]
    summaries=[]
    for spec in pack['conditions']:
        condition=conditions[spec['name']]
        raw=(HERE/spec['rgbPath']).read_bytes()
        assert sha(raw)==spec['rgbSha256']==condition['rgbSha256'] and len(raw)==4326
        assert [i for i,_ in condition['effective']]==[e['index'] for e in entries]
        v=values(condition)
        assert all(math.isfinite(x) and 0<=x<=3 for x in v)
        assert sum(v)<=mapping['budget']['maximumCurrentAtGain3']+1e-9
        rgb=[list(raw[i:i+3]) for i in range(0,len(raw),3)]
        palette=sorted({tuple(c) for c in rgb})
        summaries.append(dict(name=spec['name'],rgbSha256=spec['rgbSha256'],
            coloredSamples=sum(any(c) for c in rgb),uniqueColorCount=len(palette),rgbPalette=palette if len(palette)<=8 else None,
            requested=dose(values(condition,'requested')),effective=dose(v)))
    contrasts=[]
    for a,b in pack['primaryContrasts']:
        va,vb=values(conditions[a]),values(conditions[b]);delta=[x-y for x,y in zip(va,vb)]
        contrasts.append(dict(a=a,b=b,changedInjectedCells=sum(x!=0 for x in delta),
            changedByChannel={str(channel):sum(x!=0 for e,x in zip(entries,delta) if e['channel']==channel) for channel in [0,1]},
            currentDifferenceL1=sum(abs(x) for x in delta),currentDifferenceMaximum=max(abs(x) for x in delta),
            doseA=dose(va),doseB=dose(vb),diagnosticLuminanceExactlyEqual=conditions[a]['diagnosticLuminance']==conditions[b]['diagnosticLuminance']))
    controls=[]
    for a,b in pack['exactPairs']+pack['chromaticOffPairs']:
        assert conditions[a]['effective']==conditions[b]['effective']
        controls.append(dict(a=a,b=b,effectiveCurrentVectorsExactlyEqual=True,
            limitation='Input-only equality; downstream trajectory equality remains untested.'))
    for pair in pack['dosePairs']:
        a,b=pair['a'],pair['b'];da,db=dose(values(conditions[a])),dose(values(conditions[b]))
        difference=max(abs(da['byEyeChannel'][k]-db['byEyeChannel'][k]) for k in da['byEyeChannel']) if pair['scope']=='eyeChannel' else abs(da['total']-db['total'])
        assert difference<=1e-9
        if pair.get('equalBrightness'):
            assert conditions[a]['diagnosticLuminance']==conditions[b]['diagnosticLuminance']
            assert all(x==y for e,x,y in zip(entries,values(conditions[a]),values(conditions[b])) if e['channel']==0)
        controls.append(dict(a=a,b=b,doseScope=pair['scope'],maximumDoseDifference=difference,equalBrightness=pair.get('equalBrightness',False)))
    panels[slice_id]=dict(conditions=summaries,contrasts=contrasts,controls=controls)
color={v['name']:v for v in native['panels']['09']}
differences=[[x-y for x,y in zip(values(color[f'color-{level}-a']),values(color[f'color-{level}-b']))] for level in [1,2]]
assert differences[0]==differences[1]
assert values(color['color-1-a-off'])==values(color['color-1-b-off'])
assert values(color['color-2-a-off'])==values(color['color-2-b-off'])
used={c['rgbPath'] for p in proposal['panels'].values() for c in p['conditions']}
orphans=sorted(str(p.relative_to(HERE)) for p in (HERE/'inputs').glob('*.rgb') if str(p.relative_to(HERE)) not in used)
# Intermediate candidate images are not accepted proposal evidence; remove only unreferenced generated blobs.
for path in orphans:(HERE/path).unlink()
summary=dict(status='INPUT-ONLY checks pass; no Brain has run; requires review and new preregistration/freeze',
    proposalHash=native['proposalHash'],currentEvidenceHash=sha((HERE/'currents.json').read_bytes()),
    nativeAdapterSourceHash=native['adapterSourceHash'],nativeHelperSourceHash=native['helperSourceHash'],
    panels=panels,crossIntensityColorDifferenceVectorsExactlyEqual=True,
    patchCount=32,selectedColorPair=proposal['colorSearch']['chosen'],
    scope='Quantized RGB8, fixed support, native adapter currents and input controls only; no voltage, spikes, motor, anatomy, browser or biological claims.')
dump(HERE/'evidence.json',summary)
print(json.dumps(dict(checks='input-only pass',contrasts={s:[(c['a'],c['changedInjectedCells'],c['currentDifferenceL1']) for c in p['contrasts']] for s,p in panels.items()},colors=summary['selectedColorPair'])))
