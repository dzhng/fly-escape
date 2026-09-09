"""Check the v3 native current oracle without loading neural reports."""
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    proposal = json.loads((HERE / 'proposal.json').read_text())
    native = json.loads((HERE / 'currents.json').read_text())
    mapping = json.loads((ROOT / 'specs/done/retinal-vision/assets/05/retinal-map.json').read_text())
    entries = mapping['entries']
    assert native['proposalHash'] == sha(HERE / 'proposal.json')
    assert native['mapHash'] == proposal['mapSha256']
    assert native['graphHash'] == proposal['originalIdentities']['graphHash']
    assert native['manifestHash'] == proposal['originalIdentities']['manifestHash']
    assert native['adapterSourceHash'] == sha(ROOT / 'crates/sim/src/sensory.rs')
    assert native['helperSourceHash'] == sha(HERE.parent / 'native/src/main.rs')
    for path, digest in proposal['sourceHashes'].items():
        assert sha(ROOT / path.replace('specs/retinal-vision/', 'specs/done/retinal-vision/', 1)) == digest
    assert proposal['gain'] == 3 and len(proposal['endpoints']) == 438 and not proposal['runAuthorized']
    frozen = json.loads((HERE.parent / 'confirmation-08-v2/freeze.json').read_text())
    original = json.loads((HERE.parent / 'proposal.json').read_text())
    for key in ('gain', 'warmupTicks', 'measuredTicks', 'lifParams', 'prng', 'initialState',
                'endpoints', 'endpointRule', 'voltageResponseFloor'):
        assert proposal[key] == frozen[key]
    assert proposal['excludedInputCount'] == len(frozen['inputs'])
    assert proposal['excludedMotorReadoutCount'] == len(frozen['motorReadouts'])
    for key, value in original['panels']['08'].items():
        if key != 'conditions':
            assert proposal['panels']['08'][key] == value
    old_conditions = {c['name']: c for c in original['panels']['08']['conditions']}
    assert native['panels']['09'] == [] and native['candidateScreen'] == []
    conditions = {c['name']: c for c in native['panels']['08']}
    panel = proposal['panels']['08']
    assert list(conditions) == [c['name'] for c in panel['conditions']]

    def values(name):
        return [value for _, value in conditions[name]['effective']]

    def dose(name):
        v = values(name)
        return dict(total=sum(v), maximum=max(v), stimulatedInputCount=sum(x != 0 for x in v),
                    byEyeChannel={eye + str(channel): sum(x for e, x in zip(entries, v)
                                  if e['eye'] == eye and e['channel'] == channel)
                                  for eye in 'LR' for channel in (0, 1)})

    for spec in panel['conditions']:
        condition = conditions[spec['name']]
        assert sha(HERE / spec['rgbPath']) == spec['rgbSha256'] == condition['rgbSha256']
        assert len((HERE / spec['rgbPath']).read_bytes()) == 4326
        old = old_conditions[spec['name']]
        for flag in ('chromatic', 'permuteRows', 'silenceInputs', 'zeroCurrent'):
            assert spec[flag] == old[flag]
        if spec['name'].removesuffix('-permuted') not in proposal['patches'] and not spec['name'].startswith('occlusion-door-floor-'):
            assert spec['rgbSha256'] == old['rgbSha256']
        for kind in ('requested', 'effective'):
            assert [i for i, _ in condition[kind]] == [e['index'] for e in entries]
            currents = [x for _, x in condition[kind]]
            assert all(math.isfinite(x) and 0 <= x <= 3 for x in currents)
            assert sum(currents) <= mapping['budget']['maximumCurrentAtGain3'] + 1e-9
        if not spec['chromatic']:
            assert all(x == 0 for e, x in zip(entries, values(spec['name'])) if e['channel'] == 1)
    controls = []
    for a, b in panel['exactPairs'] + panel['chromaticOffPairs']:
        assert values(a) == values(b)
        controls.append(dict(a=a, b=b, exactEffectiveCurrents=True))
    for pair in panel['dosePairs']:
        a, b = pair['a'], pair['b']
        da, db = dose(a), dose(b)
        delta = max(abs(da['byEyeChannel'][k] - db['byEyeChannel'][k]) for k in da['byEyeChannel']) if pair['scope'] == 'eyeChannel' else abs(da['total'] - db['total'])
        assert delta <= 1e-9
        controls.append(dict(a=a, b=b, doseScope=pair['scope'], maximumDoseDifference=delta))
    for name in proposal['patches']:
        da, db = dose(name), dose(name + '-permuted')
        delta = max(abs(da['byEyeChannel'][k] - db['byEyeChannel'][k]) for k in da['byEyeChannel'])
        assert delta <= 1e-9
        controls.append(dict(a=name, b=name + '-permuted', doseScope='eyeChannel', maximumDoseDifference=delta))
    contrasts = []
    for a, b in panel['primaryContrasts']:
        delta = [x-y for x, y in zip(values(a), values(b))]
        contrasts.append(dict(a=a, b=b, changedInjectedCells=sum(x != 0 for x in delta),
                             currentDifferenceL1=sum(abs(x) for x in delta),
                             currentDifferenceMaximum=max(abs(x) for x in delta)))
    result = dict(status='Input-only native current checks pass; no v3 Brain run or seed freeze.',
                  proposalHash=sha(HERE / 'proposal.json'), currentEvidenceHash=sha(HERE / 'currents.json'),
                  verifierHash=sha(Path(__file__)),
                  conditions={name: dose(name) for name in conditions}, contrasts=contrasts, controls=controls,
                  limitation='Current coverage is feasibility evidence only; no neural-response claim.')
    (HERE / 'evidence.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps({'contrasts': contrasts, 'controls': len(controls)}))


if __name__ == '__main__':
    verify()
