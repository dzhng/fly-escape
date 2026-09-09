"""Prepare the input-only 64-cell proposal; never freezes seeds or runs Brain."""
import copy
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESLICE = HERE.parent
ROOT = RESLICE.parents[3]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare():
    original = json.loads((RESLICE / 'proposal.json').read_text())
    frozen = json.loads((RESLICE / 'confirmation-08-v2/freeze.json').read_text())
    mapping_path = ROOT / 'specs/retinal-vision/assets/05/retinal-map.json'
    mapping = json.loads(mapping_path.read_text())
    cells = mapping['profile']['layout']['cells']
    support = {(eye, channel): set() for eye in 'LR' for channel in (0, 1)}
    for entry in mapping['entries']:
        support[entry['eye'], entry['channel']].update(i for i, w in entry['taps'] if w > 0)
    patches = {}
    for name, old in original['patches'].items():
        eye, anchor = old['eye'], old['anchor']
        joint = support[eye, 0] & support[eye, 1]
        def distance2(i):
            return (cells[i]['x'] - cells[anchor]['x'])**2 + (cells[i]['y'] - cells[anchor]['y'])**2
        selected = sorted(joint, key=lambda i: (distance2(i), i))[:64]
        assert len(selected) == 64 and set(old['samples']) <= set(selected)
        patches[name] = dict(eye=eye, anchor=anchor, samples=sorted(selected), count=64,
                             maximumRadius=max(distance2(i)**.5 for i in selected),
                             availableJointSamples=len(joint))
    for eye in 'LR':
        assert not set(patches[eye + 'upper']['samples']) & set(patches[eye + 'lower']['samples'])

    floor = RESLICE / 'floor-v3'
    capture = json.loads((floor / 'capture.json').read_text())
    assert not capture['errors'] and capture['design']['mapHash'] == sha(mapping_path)
    assert capture['design']['profileIdentities'] == mapping['identities']
    cases = {case['name']: case for case in capture['cases']}
    panel = copy.deepcopy(original['panels']['08'])
    (HERE / 'inputs').mkdir(exist_ok=True)
    for condition in panel['conditions']:
        name = condition['name']
        patch_name = name.removesuffix('-permuted')
        if patch_name in patches:
            patch = patches[patch_name]
            raw = bytearray(2 * len(cells) * 3)
            for sample in patch['samples']:
                start = ((0 if patch['eye'] == 'L' else 1) * len(cells) + sample) * 3
                raw[start:start+3] = bytes([128] * 3)
            digest = hashlib.sha256(raw).hexdigest()
            path = HERE / 'inputs' / (digest + '.rgb')
            path.write_bytes(raw)
            condition.update(rgbPath=str(path.relative_to(HERE)), rgbSha256=digest,
                             origin=dict(kind='proposed 64-sample supported patch', patch=patch_name))
        elif name in ('occlusion-door-floor-open', 'occlusion-door-floor-blocked'):
            case = cases['floor-opening' if name.endswith('-open') else 'floor-blocker']
            path = floor / case['rgbPath']
            assert sha(path) == case['rgbSha256'] and case['oracleMaxByteDifference'] == 0
            assert list(path.read_bytes()) == case['samples']
            condition.update(rgbPath='../floor-v3/' + case['rgbPath'], rgbSha256=sha(path),
                origin=dict(kind='fixed-pose physical occlusion; v3 input-only redesign',
                            pose=capture['design']['pose'], sceneId=case['sceneId'],
                            source='../floor-v3/capture.json', captureHash=sha(floor / 'capture.json')))
        else:
            condition['rgbPath'] = '../' + condition['rgbPath']
            assert sha(HERE / condition['rgbPath']) == condition['rgbSha256']

    proposal = {key: copy.deepcopy(original[key]) for key in (
        'gain', 'profile', 'coefficients', 'transfer', 'warmupTicks', 'measuredTicks',
        'lifParams', 'prng', 'initialState', 'endpoints', 'endpointRule',
        'excludedInputCount', 'excludedMotorReadoutCount', 'voltageResponseFloor')}
    proposal.update(status='INPUT-ONLY v3 proposal; no seed freeze or Brain authorization',
        runAuthorized=False, mapSha256=sha(mapping_path), originalIdentities=frozen['identities'],
        patchRule=original['patchRule'].replace('32 nearest', '64 nearest'), patches=patches,
        panels={'08': panel, '09': {'conditions': []}},
        colorSearch={'candidates': []},
        panel09='Passed v2 panel remains immutable; empty oracle batch is not a new experiment.',
        statistics={**original['statistics'], 'comparisonsByPanel': {'08': 7884}},
        seedStatus='No v3 seeds proposed or frozen; separate clearance required.',
        priorEvidence={'08': '../confirmation-08-v2/evidence.json', '09': '../confirmation-09-v2/evidence.json'},
        floorDesign=capture['design'], floorChangedSamples=capture['changedSamples'],
        sourceHashes={str(path.relative_to(ROOT)): sha(path) for path in (
            Path(__file__), mapping_path, RESLICE / 'proposal.json',
            RESLICE / 'confirmation-08-v2/freeze.json', RESLICE / 'confirmation-09-v2/freeze.json',
            RESLICE / 'native/src/main.rs', ROOT / 'crates/sim/src/sensory.rs',
            floor / 'capture.json', floor / 'design.json', floor / 'capture.mjs')})
    assert len(panel['conditions']) == 37 and len(panel['primaryContrasts']) == 9
    (HERE / 'proposal.json').write_text(json.dumps(proposal, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'patches': {n: {k:v for k,v in p.items() if k != 'samples'} for n,p in patches.items()},
                      'floorChangedSamples': capture['changedSamples'], 'brainRun': False}))


if __name__ == '__main__':
    prepare()
