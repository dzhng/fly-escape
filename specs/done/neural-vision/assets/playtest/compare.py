"""Compare fixed-seed native campaign runs; no simulation or production mutation."""
from pathlib import Path
import json
p=Path(__file__).parent
rooms=[]
for room in ['open-window','turn-the-corner']:
    runs={arm:json.loads((p/f'{arm}-{room}.json').read_text()) for arm in ['before','after','vision-on','physical-on']}
    before,after,on,physical=(runs[a] for a in ['before','after','vision-on','physical-on'])
    assert before['content']==after['content']
    expected=json.loads(json.dumps(after['content']))
    expected['tuning']['cues'].append({'gain':3,'pathway':'vision'})
    assert on['content']==expected
    physical_without_lamps=json.loads(json.dumps(physical['content']))
    physical_without_lamps['level']['sources']=on['content']['level']['sources']
    assert physical_without_lamps==on['content']
    assert all(source['kind']=='lamp' for source in physical['content']['level']['sources'])
    assert all(r['spec']['flyCount']==16 and r['spec']['rootSeed']=='42' and r['spec']['placements']==[] for r in runs.values())
    assert all(r['result']['completedTick']==r['content']['level']['durationTicks'] for r in runs.values())
    rooms.append(dict(room=room,seed=42,flies=16,durationTicks=after['content']['level']['durationTicks'],
        unchangedAuthoredContent=True,visionOnOnlyAddsGain3Cue=True,
        beforeAfterBodyTrajectoryEqual=before['bodyTrajectoryHash']==after['bodyTrajectoryHash'],
        visionOnBodyTrajectoryEqual=after['bodyTrajectoryHash']==on['bodyTrajectoryHash'],
        physicalOnBodyTrajectoryEqual=on['bodyTrajectoryHash']==physical['bodyTrajectoryHash'],
        runs={arm:{k:r[k] for k in ['revision','result','wallSeconds','bodyTrajectoryHash','contentHash','manifestHash','graphHash','simulationBuildId','probeSourceHash']} for arm,r in runs.items()}))
summary=dict(scope='Two authored rooms, one paired seed42 each, sixteen flies, empty placements, natural full horizons. Before versus after production tuning tests regressions. Separate vision-on arm adds only vision gain3 under the existing uniform ambient1 with no directional light sources; the fourth arm adds explicitly modeled visible lamp sources through normal FieldSet LOS. Neither establishes broad difficulty/balance from one seed per room.',rooms=rooms)
with (p/'comparison.json').open('x') as f:json.dump(summary,f,indent=2)
print(json.dumps(summary,indent=2))
