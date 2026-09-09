"""Provisional, source-bound two-dimensional retinal registration and dose audit.

The existing vision_map CLI selects this exporter only with an explicit profile.
It never publishes graph metadata or changes the frozen color coefficients.
"""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from connectome.color_audit import inventory
from connectome.vision_map import canonical_bytes, motor_indices

FAMILIES = ('Tm2', 'Tm20')
EYES = ('L', 'R')
# These shares divide one inherited budget; they are not spectral sensitivity estimates.
FAMILY_SHARES = (.5, .5)
TAP_EPSILON = 1e-12


def digest(value):
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def barycentric_taps(position, cells):
    """The containing unit lattice triangle; zero edge/vertex weights carry no support."""
    x,y = position
    if not math.isfinite(x) or not math.isfinite(y):
        raise ValueError('Retinal position must be finite')
    q,r = x-y/math.sqrt(3), 2*y/math.sqrt(3)
    u,v = math.floor(q), math.floor(r)
    a,b = q-u,r-v
    if a+b <= 1:
        vertices,weights = [(u,v),(u+1,v),(u,v+1)],[1-a-b,a,b]
    else:
        vertices,weights = [(u+1,v),(u,v+1),(u+1,v+1)],[1-b,1-a,a+b-1]
    indices = {(cell['q'],cell['r']):i for i,cell in enumerate(cells)}
    taps = []
    for vertex,weight in zip(vertices,weights):
        if weight > TAP_EPSILON:
            if vertex not in indices:
                raise ValueError('Retinal position lies outside the sample hull')
            taps.append((indices[vertex],weight))
    total = sum(weight for _,weight in taps)
    if not taps or abs(total-1) > 3*TAP_EPSILON:
        raise ValueError('Retinal position lies outside the sample hull')
    return [(index,weight/total) for index,weight in sorted(taps)]


def source_registration(annotations, radius):
    """One isotropic registration per eye from both full source families, not graph selection."""
    transforms = {}
    for side in EYES:
        columns = annotations.loc[annotations.type.isin(FAMILIES) & (annotations.somaSide == side),
                                  ['assignedOlHex1','assignedOlHex2']].to_numpy(dtype=float)
        columns = columns[np.isfinite(columns).all(axis=1)]
        if not len(columns):
            raise ValueError(f'{side}: missing full-source coordinates')
        xy = np.column_stack((columns[:,0]+columns[:,1]/2, columns[:,1]*math.sqrt(3)/2))
        lower,upper = xy.min(axis=0),xy.max(axis=0)
        if np.any(upper <= lower):
            raise ValueError(f'{side}: degenerate full-source bounds')
        center = (lower+upper)/2
        offset = xy-center
        q,r = offset[:,0]-offset[:,1]/math.sqrt(3), 2*offset[:,1]/math.sqrt(3)
        extent = np.max(np.abs(np.column_stack((q,r,q+r))))
        transforms[side] = dict(cartesianBounds=[lower.tolist(),upper.tolist()],center=center.tolist(),
                                scale=float(radius/extent),axes=[-1 if side=='L' else 1,-1],
                                finiteSourceCount=len(columns))
    return transforms


def registered_position(hex_columns, transform):
    h1,h2 = hex_columns
    xy = np.array([h1+h2/2,h2*math.sqrt(3)/2])
    return ((xy-transform['center'])*transform['scale']*transform['axes']).tolist()


def validate_profile(bundle):
    profile = bundle['semantic']
    if (not profile.get('opticalModelVersion') or profile['eyeOrder'] != list(EYES)
        or profile['rgbOrder'] != ['R','G','B'] or profile['imageAxes'] != dict(x='right',y='down')):
        raise ValueError('Unsupported optical model or eye/RGB/image-axis order')
    capture = profile['capture']
    if (not all(isinstance(capture[k],int) and 16 <= capture[k] <= 256 for k in ('width','height'))
        or not all(math.isfinite(value) for value in capture.values())
        or not 0 < capture['verticalFovDegrees'] < 180 or capture['aspect'] <= 0
        or not 0 < capture['nearMetres'] < capture['farMetres'] or capture['zoom'] <= 0 or capture['distortion'] < 0):
        raise ValueError('Invalid optical projection')
    radius,cells = profile['layout']['radius'],profile['layout']['cells']
    if not isinstance(radius,int) or not 1 <= radius <= 15:
        raise ValueError('Unsupported regular-hex radius')
    expected = [(q,r) for r in range(-radius,radius+1) for q in range(-radius,radius+1) if abs(q+r)<=radius]
    if [(c['q'],c['r']) for c in cells] != expected:
        raise ValueError('Retinal layout must contain the ordered regular hex lattice')
    positions = np.array([[c['x'],c['y']] for c in cells],dtype=float)
    if not np.isfinite(positions).all() or not np.allclose(positions,[[q+r/2,r*math.sqrt(3)/2] for q,r in expected],rtol=0,atol=1e-12):
        raise ValueError('Retinal layout coordinates differ from its axial lattice')
    photometry = dict(encoding='linear-RGB8',exposure=1,pooling='GPU-float32-mean',
                      quantization='floor(255*clamp(mean,0,1)+0.5)',toneMapping='none')
    if profile['photometry'] != photometry:
        raise ValueError('Unsupported linear RGB8 photometry')
    rig = bundle['rig']
    rig_bytes = bundle.get('rigCanonicalJson', '')
    if (not rig_bytes or hashlib.sha256(rig_bytes.encode()).hexdigest() != rig['rigSha256']
        or json.loads(rig_bytes) != {key:value for key,value in rig.items() if key!='rigSha256'}):
        raise ValueError('Rig contents differ from their source canonical identity')
    if rig['rigSha256'] != profile['rigSha256'] or rig['units'] != 'metres' or [e['side'] for e in rig['eyes']] != list(EYES):
        raise ValueError('Rig identity, units or side order differs from profile')
    for eye in rig['eyes']:
        position,rotation = np.asarray(eye['positionMetres']),np.asarray(eye['cameraToBodyQuaternion'])
        if (position.shape != (3,) or rotation.shape != (4,) or not np.isfinite(position).all()
            or not np.isfinite(rotation).all() or abs(float(rotation@rotation)-1)>1e-10
            or position[0]*(-1 if eye['side']=='R' else 1) <= 0):
            raise ValueError('Rig eye frame contradicts the source-frozen body axes')
    return profile


def validate_color_model(model, graph_hash, annotation_hash):
    if not isinstance(model,dict):
        raise ValueError('A frozen color model is required')
    if (model['graphHash'] != graph_hash or model['annotationHash'] != annotation_hash
        or model['version'] != 1 or model['families'] != list(FAMILIES)):
        raise ValueError('Color model identity or families differ from this source graph')
    coefficients = np.asarray(model['rgbCoefficients'],dtype=float)
    if (coefficients.shape != (2,3) or not np.isfinite(coefficients).all()
        or np.any(coefficients < 0) or not np.allclose(coefficients.sum(axis=1),1,rtol=0,atol=1e-12)
        or model['baseline'] != 0 or model['transfer'] != 'q/(q+0.5)' or model['dose']['gainMaximum'] != 3):
        raise ValueError('Frozen model requires finite nonnegative RGB coefficients, zero baseline and bounded transfer; signed channels require a new model')
    if np.linalg.matrix_rank(coefficients) < 2:
        raise ValueError('Color model must retain independent stimulus dimensions')
    return coefficients


def build_retinal_map(annotations, manifest, matrix, annotation_hash, bundle, model):
    from scipy import sparse
    profile = validate_profile(bundle)
    validate_color_model(model,manifest['graphHash'],annotation_hash)
    anatomy = inventory(annotations,manifest,matrix,annotation_hash)
    cells = profile['layout']['cells']
    samples = len(cells)
    transforms = source_registration(annotations,profile['layout']['radius'])
    entries, audited = [], []
    for channel,family in enumerate(FAMILIES):
        for cell in anatomy['families'][family]['cells']:
            audited_cell = dict(cell,family=family)
            if not cell['rejected']:
                position = registered_position(cell['hex'],transforms[cell['side']])
                taps = barycentric_taps(position,cells)
                audited_cell.update(position=position,rawTaps=taps)
                entries.append(dict(index=cell['index'],bodyId=cell['bodyId'],eye=cell['side'],channel=channel,taps=taps))
            audited.append(audited_cell)
    entries.sort(key=lambda entry:entry['index'])
    rows,columns,values = [],[],[]
    for row,entry in enumerate(entries):
        for sample,weight in entry['taps']:
            rows.append(row)
            columns.append((entry['channel']*2+EYES.index(entry['eye']))*samples+sample)
            values.append(weight)
    raw = sparse.csr_matrix((values,(rows,columns)),shape=(len(entries),4*samples))
    column_sums = np.asarray(raw.sum(axis=0)).ravel()
    support = (column_sums > 0).reshape(2,2,samples)
    if not np.all(support.any(axis=2)):
        raise ValueError('Both frozen channels require eligible support in both eyes')
    baseline = manifest['visionInput']
    old_entries = baseline['entries']
    old_weights = np.asarray([e['weights'] for e in old_entries],dtype=float)
    old_indices = [e['index'] for e in old_entries]
    eligible_tm2 = {cell['index'] for cell in audited if cell['family']=='Tm2' and not cell['rejected']}
    if (baseline['family'] != 'Tm2' or baseline['graphHash'] != manifest['graphHash']
        or baseline['annotationHash'] != annotation_hash or len(old_indices) != len(set(old_indices))
        or set(old_indices) != eligible_tm2 or old_weights.shape != (len(old_indices),8)
        or not np.isfinite(old_weights).all() or np.any(old_weights<0) or np.max(old_weights.sum(axis=1))>1+1e-12):
        raise ValueError('Baseline visual budget must be the source-matched bounded Tm2 map')
    baseline_budget = float(old_weights.sum())
    if baseline_budget <= 0:
        raise ValueError('Baseline visual budget is empty')
    column_scales = np.zeros(4*samples)
    for channel,share in enumerate(FAMILY_SHARES):
        start,end = channel*2*samples,(channel+1)*2*samples
        sums = column_sums[start:end]
        selected = sums > 0
        column_scales[start:end][selected] = share*baseline_budget/selected.sum()/sums[selected]
    weights = raw @ sparse.diags(column_scales)
    row_sums = np.asarray(weights.sum(axis=1)).ravel()
    global_scale = min(1.,1./float(row_sums.max()))
    weights *= global_scale
    weights.sort_indices()
    for row,entry in enumerate(entries):
        start,end = weights.indptr[row:row+2]
        entry['taps'] = [(int(col%samples),float(weight)) for col,weight in zip(weights.indices[start:end],weights.data[start:end])]
    budget = dict(baselineWeightSum=baseline_budget,familyFractions=dict(zip(FAMILIES,FAMILY_SHARES)),globalScale=global_scale,
        totalWeight=float(weights.sum()),maximumRowSum=float(np.max(np.asarray(weights.sum(axis=1)))),
        familyWeightSums={family:float(weights[[e['channel']==channel for e in entries]].sum()) for channel,family in enumerate(FAMILIES)},
        baselineMaximumCurrentAtGain3=2*baseline_budget,maximumCurrentAtGain3=2*float(weights.sum()))
    mapping = dict(version=1,status='provisional: final profile and neural proof pending',
        identities=dict(graphHash=manifest['graphHash'],annotationHash=annotation_hash,profileHash=digest(profile),
                        layoutHash=digest(profile['layout']),rigHash=profile['rigSha256'],colorModelHash=digest(model),baselineMapHash=digest(baseline)),
        profile=profile,colorModel=model,registration=dict(eyes=transforms,
            scope='MODELED: shared full-source Tm2/Tm20 Cartesian bounds per eye; isotropic fit to the sample hexagon. Left horizontal mirroring and source embedded +Y to image-up are conventions, not anatomical calibration.'),
        budget=budget,support={family:{side:support[channel,eye].tolist() for eye,side in enumerate(EYES)} for channel,family in enumerate(FAMILIES)},entries=entries)
    source_coverage = {}
    for family in FAMILIES:
        source_coverage[family] = {}
        for side in EYES:
            counts = np.zeros(samples,dtype=int)
            source_rows = annotations[(annotations.type==family)&(annotations.somaSide==side)]
            for point in source_rows[['assignedOlHex1','assignedOlHex2']].to_numpy(dtype=float):
                if np.isfinite(point).all():
                    for sample,_ in barycentric_taps(registered_position(point,transforms[side]),cells):
                        counts[sample]+=1
            source_coverage[family][side] = counts.tolist()
    report = dict(identities=mapping['identities'],profileStatus=bundle['status'],provenance=bundle.get('provenance',{}),
        sourceFamilies={family:{key:value for key,value in anatomy['families'][family].items() if key!='cells'} for family in FAMILIES},
        cells=audited,sourceCoverage=source_coverage,budget=budget,
        pathScope=anatomy['pathScope'],spatialScope='At most three local taps; missing samples remain absent. No behavioral or physiological calibration.')
    validate_retinal_map(mapping,manifest,bundle,model)
    return mapping,report


def retinal_currents(mapping, rgb8, gain=3):
    rgb = np.asarray(rgb8)
    samples = len(mapping['profile']['layout']['cells'])
    if rgb.dtype != np.uint8 or rgb.shape != (2,samples,3) or not math.isfinite(gain) or not 0 <= gain <= 3:
        raise ValueError('Retinal current requires paired canonical RGB8 and gain in [0,3]')
    coefficients = np.asarray(mapping['colorModel']['rgbCoefficients'])
    q = (rgb.astype(float)/255) @ coefficients.T
    responses = q/(q+.5)
    return np.array([gain*sum(weight*responses[EYES.index(entry['eye']),sample,entry['channel']]
                             for sample,weight in entry['taps']) for entry in mapping['entries']])


def validate_retinal_map(mapping, manifest, bundle, model):
    """Independent exported numeric/identity gate; anatomy comes from the source audit."""
    profile = validate_profile(bundle)
    annotation_hash = next(s['sha256'] for s in manifest['sources'] if s['file']=='body-annotations.feather')
    validate_color_model(model,manifest['graphHash'],annotation_hash)
    expected = dict(graphHash=manifest['graphHash'],annotationHash=annotation_hash,profileHash=digest(profile),
                    layoutHash=digest(profile['layout']),rigHash=profile['rigSha256'],colorModelHash=digest(model),baselineMapHash=digest(manifest['visionInput']))
    if mapping['identities'] != expected or mapping['profile'] != profile or mapping['colorModel'] != model:
        raise ValueError('Retinal map identity differs from graph/profile/layout/rig/color model')
    samples = len(profile['layout']['cells'])
    support = np.zeros((2,2,samples),dtype=bool)
    motor,seen,row_sums = motor_indices(manifest),set(),[]
    for entry in mapping['entries']:
        index = entry['index']
        if (not isinstance(index,int) or index in seen or index in motor or not 0<=index<len(manifest['bodyIds'])
            or entry['bodyId'] != manifest['bodyIds'][index] or entry['eye'] not in EYES or entry['channel'] not in (0,1)):
            raise ValueError('Retinal map target identity or motor exclusion failed')
        seen.add(index)
        taps = entry['taps']
        if not 1<=len(taps)<=3 or len({sample for sample,_ in taps}) != len(taps):
            raise ValueError('Retinal map requires one to three distinct local taps')
        total = 0
        for sample,weight in taps:
            if not isinstance(sample,int) or not 0<=sample<samples or not math.isfinite(weight) or weight<=0:
                raise ValueError('Retinal map taps must be finite, positive and within the layout')
            total += weight
            support[entry['channel'],EYES.index(entry['eye']),sample] = True
        if total > 1+1e-12:
            raise ValueError('Retinal map exceeds the per-cell gain bound')
        row_sums.append(total)
    expected_support = {family:{side:support[channel,eye].tolist() for eye,side in enumerate(EYES)} for channel,family in enumerate(FAMILIES)}
    if mapping['support'] != expected_support or not np.all(support.any(axis=2)):
        raise ValueError('Retinal map support masks differ from actual taps')
    baseline_budget = sum(sum(e['weights']) for e in manifest['visionInput']['entries'])
    if sum(row_sums) > baseline_budget+1e-9 or not math.isclose(sum(row_sums),mapping['budget']['totalWeight'],abs_tol=1e-9):
        raise ValueError('Retinal map exceeds or misreports its one combined visual budget')


def current_fixtures(mapping):
    samples = len(mapping['profile']['layout']['cells'])
    cases = []
    for patch in mapping['colorModel']['patches']:
        rgb = np.tile(np.array(patch['rgb8'],dtype=np.uint8),(2,samples,1))
        cases.append(dict(name=patch['name'],fillRgb8=patch['rgb8'],updates=[],
                          expectedCurrentByEntry=retinal_currents(mapping,rgb).tolist()))
    rgb = np.zeros((2,samples,3),dtype=np.uint8)
    updates = []
    coordinates = np.array([[c['x'],c['y']] for c in mapping['profile']['layout']['cells']])
    for eye,side in enumerate(EYES):
        supported = [i for i in range(samples) if all(mapping['support'][family][side][i] for family in FAMILIES)]
        if len(supported)<2:
            raise ValueError('Chromatic controls require two jointly supported locations per eye')
        first = supported[0]
        second = max(supported,key=lambda i:float(np.sum((coordinates[i]-coordinates[first])**2)))
        for sample,value in [(first,[100,100,100]),(second,[35,117,123])]:
            rgb[eye,sample] = value
            updates.append(dict(eye=side,sample=sample,rgb8=value))
    before = retinal_currents(mapping,rgb)
    cases.append(dict(name='supported-color-pair',fillRgb8=[0,0,0],updates=updates,expectedCurrentByEntry=before.tolist()))
    swapped = []
    for eye,side in enumerate(EYES):
        pair = [u for u in updates if u['eye']==side]
        for original,other in zip(pair,pair[::-1]):
            rgb[eye,original['sample']] = other['rgb8']
            swapped.append(dict(eye=side,sample=original['sample'],rgb8=other['rgb8']))
    after = retinal_currents(mapping,rgb)
    cases.append(dict(name='supported-color-pair-swapped',fillRgb8=[0,0,0],updates=swapped,expectedCurrentByEntry=after.tolist()))
    brightness = np.array([e['channel']==0 for e in mapping['entries']])
    if not np.allclose(before[brightness],after[brightness],rtol=0,atol=1e-12) or not np.any(np.abs(before[~brightness]-after[~brightness])>1e-12):
        raise ValueError('Supported color control lost brightness equality or independent chromatic current')
    for eye in EYES:
        for channel in (0,1):
            selected = np.array([e['eye']==eye and e['channel']==channel for e in mapping['entries']])
            if not math.isclose(float(before[selected].sum()),float(after[selected].sum()),abs_tol=1e-12):
                raise ValueError('Supported color control changed weighted per-eye/channel dose')
    return dict(gain=3,scope='Offline adapter oracle only; selected locations maximize geometric separation within joint support, without neural/motor experiments.',
                entryIndices=[e['index'] for e in mapping['entries']],cases=cases)


def registration_atlas(mapping, report):
    """Coverage in recorded image axes; every cell is shown, with one local-tap example per panel."""
    size = len(mapping['profile']['layout']['cells'])
    radius = mapping['profile']['layout']['radius']
    scale = 178/radius
    cells = mapping['profile']['layout']['cells']
    pieces = ['<svg xmlns="http://www.w3.org/2000/svg" width="1460" height="1120" viewBox="0 0 1460 1120">',
              '<rect width="1460" height="1120" fill="#f5f7fa"/><g font-family="Arial,sans-serif" fill="#192538">',
              '<text x="30" y="38" font-size="25">Provisional retinal registration — coverage is not uniform</text>',
              f'<text x="30" y="66" font-size="16">{size} RGB8 samples per eye. Full-source bounds; no selected-population stretching.</text>',
              '<text x="30" y="91" font-size="14">Blue: retained support · Peach: source support missing from retained graph · Gray: no mapped full-source support</text>',
              '<text x="30" y="114" font-size="14">Dots: retained neurons. Pink: one example and its local taps. Image +X right, +Y down; source +Y maps up.</text>']
    for channel,family in enumerate(FAMILIES):
        for eye,side in enumerate(EYES):
            left,top = 20+eye*720,135+channel*460
            cx,cy = left+275,top+220
            supported = mapping['support'][family][side]
            source = report['sourceCoverage'][family][side]
            neurons = [c for c in report['cells'] if c['family']==family and c['side']==side and not c['rejected']]
            rejected = [c for c in report['cells'] if c['family']==family and c['side']==side and c['rejected']]
            current = 2*sum(sum(w for _,w in e['taps']) for e in mapping['entries'] if e['channel']==channel and e['eye']==side)
            pieces += [f'<rect x="{left}" y="{top}" width="700" height="446" rx="8" fill="white" stroke="#cbd3dd"/>',
                f'<text x="{left+16}" y="{top+28}" font-size="20">{family} — {side} eye</text>',
                f'<text x="{left+16}" y="{top+51}" font-size="14">{sum(supported)}/{size} samples supported · {len(neurons)} eligible neurons · {len(rejected)} rejected neurons</text>']
            for i,cell in enumerate(cells):
                x,y = cx+cell['x']*scale,cy+cell['y']*scale
                vertices = ' '.join(f'{x+scale*.56*math.cos(math.pi/6+k*math.pi/3):.3f},{y+scale*.56*math.sin(math.pi/6+k*math.pi/3):.3f}' for k in range(6))
                fill = '#9fc3e8' if supported[i] else '#f3cfb3' if source[i] else '#eceff3'
                pieces.append(f'<polygon points="{vertices}" fill="{fill}" stroke="#b6c1ce" stroke-width="0.5"/>')
            for neuron in neurons:
                x,y = neuron['position']
                pieces.append(f'<circle cx="{cx+x*scale:.3f}" cy="{cy+y*scale:.3f}" r="1.5" fill="#24394c"/>')
            example = min(neurons,key=lambda c:(sum(v*v for v in c['position']),int(c['bodyId'])))
            x,y = example['position'];px,py=cx+x*scale,cy+y*scale
            for sample,_ in example['rawTaps']:
                target=cells[sample]
                pieces.append(f'<line x1="{px:.3f}" y1="{py:.3f}" x2="{cx+target["x"]*scale:.3f}" y2="{cy+target["y"]*scale:.3f}" stroke="#b22068" stroke-width="2"/>')
            # A separate zoom preserves the whole coverage map while exposing all local taps.
            ix,iy = left+620,top+220
            pieces += [f'<rect x="{ix-57}" y="{iy-60}" width="114" height="120" fill="white" stroke="#cbd3dd"/>',
                       f'<text x="{ix-49}" y="{iy-44}" font-size="11">{len(example["rawTaps"])} tap(s); sample IDs</text>']
            for sample,weight in example['rawTaps']:
                target=cells[sample];tx=ix+(target['x']-x)*33;ty=iy+(target['y']-y)*33
                pieces += [f'<line x1="{ix}" y1="{iy}" x2="{tx:.3f}" y2="{ty:.3f}" stroke="#b22068"/>',
                           f'<circle cx="{tx:.3f}" cy="{ty:.3f}" r="3" fill="#365f83"/>',
                           f'<text x="{tx+4:.3f}" y="{ty-5:.3f}" font-size="9">{sample}</text>']
            pieces.append(f'<circle cx="{ix}" cy="{iy}" r="4" fill="none" stroke="#b22068" stroke-width="2"/>')
            pieces += [f'<circle cx="{px:.3f}" cy="{py:.3f}" r="4" fill="none" stroke="#b22068" stroke-width="2"/>',
                f'<text x="{left+16}" y="{top+397}" font-size="13">Uniform white: total current {current:.3f} at gain 3. Missing coordinates are not plotted.</text>',
                f'<text x="{left+16}" y="{top+418}" font-size="13">Example {example["bodyId"]}: relay path {" → ".join(example["relayPath"])}</text>',
                f'<text x="{left+16}" y="{top+438}" font-size="12">Source +X points {"left (modeled mirror)" if side=="L" else "right (modeled)"}; every path and weight is in the audit.</text>']
    budget = mapping['budget']
    pieces += [f'<text x="30" y="1080" font-size="15">One aggregate weight budget: {budget["baselineWeightSum"]:.3f} baseline → {budget["totalWeight"]:.3f}; equal family shares; maximum row sum {budget["maximumRowSum"]:.3f}.</text>',
               '<text x="30" y="1103" font-size="14">Geometry and orientation are modeled. Final optical profile, shared lighting and downstream neural proof remain pending.</text>', '</g></svg>']
    return '\n'.join(pieces)


def export_retinal(annotations, manifest, matrix, annotation_hash, bundle, model, output):
    import json
    mapping,report = build_retinal_map(annotations,manifest,matrix,annotation_hash,bundle,model)
    fixtures = current_fixtures(mapping)
    report['exporterSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    report['doseChecks'] = [dict(name=case['name'],totalCurrent=sum(case['expectedCurrentByEntry']),maximumCellCurrent=max(case['expectedCurrentByEntry'])) for case in fixtures['cases']]
    output.mkdir(parents=True,exist_ok=True)
    for filename,value in [('retinal-map.json',mapping),('audit.json',report),('current-fixtures.json',fixtures),
                           ('profile-canonical.json',bundle['semantic']),('layout-canonical.json',bundle['semantic']['layout']),
                           ('color-model-canonical.json',model),('baseline-map-canonical.json',manifest['visionInput'])]:
        (output/filename).write_bytes(canonical_bytes(value))
    (output/'registration-atlas.svg').write_text(registration_atlas(mapping,report))
    print(json.dumps(dict(entries=len(mapping['entries']),budget=mapping['budget'],
                         support={f:{s:sum(v) for s,v in eyes.items()} for f,eyes in mapping['support'].items()}),sort_keys=True))
