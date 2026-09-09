"""Prepare v2 packs only after compact-budget publication; never constructs a Brain or freezes sources."""
import argparse
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
def sha(raw): return hashlib.sha256(raw).hexdigest()
def read(path): return json.loads(path.read_bytes())

def prepare(graph_dir, output):
    proposal=read(HERE/'proposal.json')
    mapping=read(ROOT/'specs/retinal-vision/assets/05/retinal-map.json')
    manifest_bytes=(graph_dir/'manifest.json').read_bytes()
    manifest=json.loads(manifest_bytes)
    identities=mapping['identities']
    expected_budget=dict(sourceGraphHash=identities['graphHash'], annotationHash=identities['annotationHash'],
        sourceMapHash=identities['baselineMapHash'],weightSum=mapping['budget']['baselineWeightSum'])
    if 'visionInput' in manifest or manifest.get('retinalBudget') != expected_budget:
        raise ValueError('HOLD: compact retinalBudget cutover is not published; no pack or freeze written')
    if sha((graph_dir/'graph.bin').read_bytes())!=proposal['originalIdentities']['graphHash']:
        raise ValueError('Accepted graph bytes changed')
    if sha((ROOT/'specs/retinal-vision/assets/05/retinal-map.json').read_bytes())!=proposal['mapSha256']:
        raise ValueError('Accepted retinal map bytes changed')
    verification=read(HERE/'verification.json')
    if sha((HERE/'currents.json').read_bytes())!=verification['currentEvidenceHash']:
        raise ValueError('Accepted input-current evidence changed')
    if sha((HERE/'proposal.json').read_bytes())!=verification['proposalHash']:
        raise ValueError('Accepted input proposal changed')
    baseline=ROOT/'specs/retinal-vision/assets/08/confirmation/freeze.json'
    if sha(baseline.read_bytes())!=proposal['sourceHashes']['original08Freeze']:
        raise ValueError('Original reference population identity changed')
    files={'accepted-proposal.json':(HERE/'proposal.json').read_bytes(),
        'accepted-currents.json':(HERE/'currents.json').read_bytes(),
        'accepted-baseline.json':baseline.read_bytes(),
        'preregistration.md':(HERE/'preregistration.md').read_bytes()}
    for panel in proposal['panels'].values():
        for condition in panel['conditions']:
            name=condition['rgbPath'];raw=(HERE/name).read_bytes()
            if sha(raw)!=condition['rgbSha256']:raise ValueError('Accepted RGB bytes changed')
            files[name]=raw
    binding=lambda name:dict(path=name,sha256=sha(files[name]))
    references=dict(proposal=binding('accepted-proposal.json'),currents=binding('accepted-currents.json'),
        baseline=binding('accepted-baseline.json'),protocol=binding('preregistration.md'),manifestSha256=sha(manifest_bytes))
    packs={}
    for slice_id,panel in proposal['panels'].items():
        packs[slice_id]=dict(panel,version=2,phase='reslice-confirmation',profile=proposal['profile'],reslice=references,
            analysisSha256=sha((ROOT/'specs/retinal-vision/assets/08/analyze.py').read_bytes()),
            statisticsOwnerSha256=sha((ROOT/'scripts/connectome/analyze_neural_vision.py').read_bytes()),
            preregistrationSha256=references['protocol']['sha256'],
            scope='Accepted supported-area/luminance-context experiment; freeze separately after root clearance. No completed browser proof.')
    output.mkdir(parents=True,exist_ok=False)
    for name,raw in files.items():
        path=output/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
    for slice_id,pack in packs.items():
        (output/f'inputs-{slice_id}-v2.json').write_text(json.dumps(pack,indent=2,sort_keys=True)+'\n')
    print(json.dumps(dict(status='v2 packs prepared; no freeze or Brain run',directory=str(output),
        manifestSha256=sha(manifest_bytes),seeds=proposal['proposedSeeds'])))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('graph_dir',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();prepare(args.graph_dir,args.output)
