"""Input-only reslice construction from frozen geometry, RGB8 gamut and adapter arithmetic."""
import copy
import hashlib
import itertools
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
OLD = ROOT / 'specs/done/retinal-vision/assets/08'
MAP = ROOT / 'specs/done/retinal-vision/assets/05/retinal-map.json'

def sha(raw): return hashlib.sha256(raw).hexdigest()
def dump(path, value): path.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n')
def luminance(rgb): return sum(v / 255 * c for v, c in zip(rgb, [.2126, .7152, .0722]))
def blue(v): return (v / 255) / (v / 255 + .5)

def prepare():
    mapping = json.loads(MAP.read_bytes())
    cells = mapping['profile']['layout']['cells']
    support = {(eye, channel): set() for eye in ['L', 'R'] for channel in [0, 1]}
    for entry in mapping['entries']:
        support[entry['eye'], entry['channel']].update(i for i, weight in entry['taps'] if weight > 0)
    patches = {}
    for name, eye, anchor in [('Lupper','L',163), ('Llower','L',562), ('Rupper','R',170), ('Rlower','R',567)]:
        joint = support[eye, 0] & support[eye, 1]
        distance2 = lambda i: (cells[i]['x']-cells[anchor]['x'])**2 + (cells[i]['y']-cells[anchor]['y'])**2
        selected = sorted(joint, key=lambda i: (distance2(i), i))[:32]
        patches[name] = dict(eye=eye, anchor=anchor, samples=sorted(selected), count=len(selected),
            maximumRadius=max(distance2(i)**.5 for i in selected), availableJointSamples=len(joint))
    for eye in ['L','R']:
        assert not set(patches[eye+'upper']['samples']) & set(patches[eye+'lower']['samples'])
    # Fixed search domain: diagnostic luminance 100/255, room for +100 R/G,
    # native exact luminance/current equality at both levels, then maximum blue contrast.
    gamut = []
    for r in range(156):
        for g in range(156):
            remaining = 1000000 - 2126*r - 7152*g
            if remaining % 722 == 0 and 0 <= remaining // 722 <= 255:
                gamut.append((r,g,remaining//722))
    candidates = []
    for a,b in itertools.combinations(gamut,2):
        low, high = sorted((a,b), key=lambda rgb: rgb[2])
        candidates.append(dict(a=list(low), b=list(high), blueContrast=blue(high[2])-blue(low[2])))
    candidates.sort(key=lambda c: (-c['blueContrast'], c['a'], c['b']))
    screen_path=HERE/'candidate-screen.json'
    native_screen=json.loads(screen_path.read_bytes()) if screen_path.exists() else None
    if native_screen:
        assert native_screen['mapHash']==sha(MAP.read_bytes())
        assert native_screen['helperSourceHash']==sha((HERE/'native/src/main.rs').read_bytes())
        assert native_screen['adapterSourceHash']==sha((ROOT/'crates/sim/src/sensory.rs').read_bytes())
        assert [r['candidate'] for r in native_screen['candidateScreen']]==candidates
        eligible=[r['candidate'] for r in native_screen['candidateScreen'] if all(v['brightnessCurrentsExactlyEqual'] and v['diagnosticLuminanceExactlyEqual'] for v in r['levels'])]
        assert eligible
        chosen=eligible[0]
    else:
        chosen=candidates[0]
    levels = [dict(a=[chosen['a'][0]+k,chosen['a'][1]+k,chosen['a'][2]],
                   b=[chosen['b'][0]+k,chosen['b'][1]+k,chosen['b'][2]], addRedGreen=k) for k in [0,100]]
    (HERE/'inputs').mkdir(exist_ok=True)
    def store(raw):
        name = 'inputs/'+sha(raw)+'.rgb'; path = HERE/name
        if path.exists(): assert path.read_bytes() == raw
        else: path.write_bytes(raw)
        return name, sha(raw)
    def image(updates):
        raw=bytearray(2*len(cells)*3)
        for patch, color in updates:
            for sample in patch['samples']:
                start=((0 if patch['eye']=='L' else 1)*len(cells)+sample)*3
                raw[start:start+3]=bytes(color)
        return bytes(raw)
    panels={}
    for slice_id in ['08','09']:
        old=json.loads((OLD/f'confirmation-inputs-{slice_id}.json').read_bytes())
        pack={k:copy.deepcopy(old[k]) for k in ['slice','conditions','primaryContrasts','exactPairs','chromaticOffPairs','dosePairs']}
        for condition in pack['conditions']:
            raw=(OLD/condition['rgbPath']).read_bytes()
            name=condition['name']
            if slice_id=='08' and name.removesuffix('-permuted') in patches:
                raw=image([(patches[name.removesuffix('-permuted')],[128]*3)])
                condition['origin']={'kind':'proposed 32-sample supported patch','patch':name.removesuffix('-permuted')}
            elif slice_id=='09':
                level=levels[0 if '-1-' in name else 1]
                if name.startswith('uniform-'):
                    raw=bytes(level['a' if name.endswith('-a') else 'b'])*(2*len(cells))
                elif name.endswith('-gray'):
                    # Quantized grayscale is descriptive only; high level has fractional diagnostic luminance.
                    gray=round(luminance(level['a'])*255)
                    raw=image([(patch,[gray]*3) for patch in patches.values()])
                else:
                    swapped='-b' in name
                    raw=image([(patch,level['b' if (key.endswith('upper') == swapped) else 'a']) for key,patch in patches.items()])
                condition['origin']={'kind':'proposed matched-adapter-contrast RGB8','level':1 if '-1-' in name else 2,
                    'grayscaleDiagnosticOnly':name.endswith('-gray')}
            condition['rgbPath'],condition['rgbSha256']=store(raw)
        panels[slice_id]=pack
    original=json.loads((OLD/'confirmation/freeze.json').read_bytes())
    proposal=dict(status='INPUT-ONLY PROPOSAL; not preregistered or authorized for Brain execution', runAuthorized=False,
        protocol='proposed retinal supported-area reslice', sourceCommit='bd5a09a8', gain=3,
        mapSha256=sha(MAP.read_bytes()), profile=mapping['identities'], coefficients=mapping['colorModel']['rgbCoefficients'],
        transfer=mapping['colorModel']['transfer'], originalIdentities=original['identities'],
        proposedSeeds=list(range(200,230)), seedsUsedPreviously=list(range(1,7))+list(range(100,130)),
        warmupTicks=60, measuredTicks=100, lifParams=original['lifParams'], prng=original['prng'], initialState=original['initialState'],
        endpoints=original['endpoints'], endpointRule=original['endpointRule'], excludedInputCount=len(original['inputs']),
        excludedMotorReadoutCount=len(original['motorReadouts']), voltageResponseFloor=original['voltageResponseFloor'],
        statistics=dict(primary='paired mean voltage',secondary='paired spike count',alpha=.05,
            correction='two-sided Bonferroni simultaneous intervals over both measures, all 438 endpoints and every primary contrast within each panel',
            comparisonsByPanel={s:2*len(original['endpoints'])*len(p['primaryContrasts']) for s,p in panels.items()},
            acceptance='Every primary contrast requires at least one corrected voltage interval wholly beyond +/-1e-9; all exact and dose controls must pass.'),
        patchRule='32 nearest joint-support samples to each unchanged original anchor, ordered by squared image-plane distance then sample index; require within-eye disjointness.',
        patches=patches, colorSearch=dict(domain='integer diagnostic luminance 100/255; R,G <=155; add 100 to both R/G at higher level, hold B unchanged; exact native diagnostic luminance/current equality at both levels',
            criterion='among native-exact brightness matches at both levels, maximize blue transfer contrast; lexicographic RGB tie-break; no neural response evaluated', nativeScreenHash=sha(screen_path.read_bytes()) if native_screen else None,candidateCount=len(candidates),candidates=candidates,chosen=chosen,levels=levels),
        panels=panels, sourceHashes={'prepare.py':sha(Path(__file__).read_bytes()),'native/src/main.rs':sha((HERE/'native/src/main.rs').read_bytes()),
            'original08Freeze':sha((OLD/'confirmation/freeze.json').read_bytes()),'original09Freeze':sha((ROOT/'specs/done/retinal-vision/assets/09/confirmation/freeze.json').read_bytes())})
    assert set(proposal['proposedSeeds']).isdisjoint(proposal['seedsUsedPreviously'])
    dump(HERE/'proposal.json',proposal)
    print(json.dumps(dict(patches=patches,colors=levels,candidates=len(candidates))))

if __name__=='__main__': prepare()
