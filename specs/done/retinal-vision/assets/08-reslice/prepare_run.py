"""Prepare accepted reslice packs; never constructs a Brain or freezes sources."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
def sha(raw): return hashlib.sha256(raw).hexdigest()
def read(path): return json.loads(path.read_bytes())

def prepare(graph_dir, output, version=2):
    accepted = HERE if version == 2 else HERE/'v3'
    proposal=read(accepted/'proposal.json')
    mapping=read(ROOT/'specs/done/retinal-vision/assets/05/retinal-map.json')
    manifest_bytes=(graph_dir/'manifest.json').read_bytes()
    manifest=json.loads(manifest_bytes)
    identities=mapping['identities']
    expected_budget=dict(sourceGraphHash=identities['graphHash'], annotationHash=identities['annotationHash'],
        sourceMapHash=identities['baselineMapHash'],weightSum=mapping['budget']['baselineWeightSum'])
    if 'visionInput' in manifest or manifest.get('retinalBudget') != expected_budget:
        raise ValueError('HOLD: compact retinalBudget cutover is not published; no pack or freeze written')
    if sha((graph_dir/'graph.bin').read_bytes())!=proposal['originalIdentities']['graphHash']:
        raise ValueError('Accepted graph bytes changed')
    if sha((ROOT/'specs/done/retinal-vision/assets/05/retinal-map.json').read_bytes())!=proposal['mapSha256']:
        raise ValueError('Accepted retinal map bytes changed')
    verification=read(accepted/('verification.json' if version == 2 else 'evidence.json'))
    if sha((accepted/'currents.json').read_bytes())!=verification['currentEvidenceHash']:
        raise ValueError('Accepted input-current evidence changed')
    if sha((accepted/'proposal.json').read_bytes())!=verification['proposalHash']:
        raise ValueError('Accepted input proposal changed')
    baseline_relative='specs/done/retinal-vision/assets/08/confirmation/freeze.json' if version == 2 else 'specs/done/retinal-vision/assets/08-reslice/confirmation-08-v2/freeze.json'
    baseline=ROOT/baseline_relative
    baseline_key='original08Freeze' if version == 2 else baseline_relative
    if sha(baseline.read_bytes())!=proposal['sourceHashes'][baseline_key]:
        raise ValueError('Original reference population identity changed')
    files={'accepted-proposal.json':(accepted/'proposal.json').read_bytes(),
        'accepted-currents.json':(accepted/'currents.json').read_bytes(),
        'accepted-baseline.json':baseline.read_bytes(),
        'preregistration.md':(accepted/'preregistration.md').read_bytes()}
    panels=copy.deepcopy(proposal['panels'])
    if version == 3:
        panels={'08':panels['08']}
    for panel in panels.values():
        for condition in panel['conditions']:
            raw=(accepted/condition['rgbPath']).read_bytes()
            if sha(raw)!=condition['rgbSha256']:raise ValueError('Accepted RGB bytes changed')
            name=f"inputs/{condition['rgbSha256']}.rgb" if version == 3 else condition['rgbPath']
            condition['rgbPath']=name
            files[name]=raw
    binding=lambda name:dict(path=name,sha256=sha(files[name]))
    references=dict(proposal=binding('accepted-proposal.json'),currents=binding('accepted-currents.json'),
        baseline=binding('accepted-baseline.json'),protocol=binding('preregistration.md'),manifestSha256=sha(manifest_bytes))
    packs={}
    for slice_id,panel in panels.items():
        packs[slice_id]=dict(panel,version=version,phase='reslice-confirmation' if version == 2 else 'spatial-confirmation',profile=proposal['profile'],reslice=references,
            analysisSha256=sha((ROOT/'specs/done/retinal-vision/assets/08/analyze.py').read_bytes()),
            statisticsOwnerSha256=sha((ROOT/'scripts/connectome/analyze_neural_vision.py').read_bytes()),
            preregistrationSha256=references['protocol']['sha256'],
            scope=('Accepted supported-area/luminance-context experiment' if version == 2 else 'Accepted spatial/brightness/occlusion experiment')
                + '; freeze separately after root clearance. No completed browser proof.')
    output.mkdir(parents=True,exist_ok=False)
    for name,raw in files.items():
        path=output/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
    for slice_id,pack in packs.items():
        (output/f'inputs-{slice_id}-v{version}.json').write_text(json.dumps(pack,indent=2,sort_keys=True)+'\n')
    print(json.dumps(dict(status=f'v{version} packs prepared; no freeze or Brain run',directory=str(output),
        manifestSha256=sha(manifest_bytes),seeds=proposal['proposedSeeds'] if version == 2 else list(range(300,330)))))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('graph_dir',type=Path);parser.add_argument('output',type=Path)
    parser.add_argument('--version',type=int,choices=[2,3],default=2)
    args=parser.parse_args();prepare(args.graph_dir,args.output,args.version)
