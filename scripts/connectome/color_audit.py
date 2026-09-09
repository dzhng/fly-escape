"""Source-verified retained color anatomy; no graph mutation or neural simulation.

Run with PYTHONPATH=scripts python -m connectome.color_audit --help.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from connectome.artifact import read_binary
from connectome.graph_audit import canonical_bytes, motor_indices, paths_to, witness

FAMILIES = ('Tm2', 'Tm20', 'Tm5a', 'Tm5b', 'Tm5c')
COEFFICIENTS = [[0.2126, 0.7152, 0.0722], [0, 0, 1]]
PATCHES = [('black', [0,0,0]), ('gray 64', [64,64,64]), ('gray 128', [128,128,128]),
           ('white', [255,255,255]), ('red', [255,0,0]), ('green', [0,255,0]),
           ('blue', [0,0,255]), ('match A', [100,100,100]), ('match B', [35,117,123])]


def channels(rgb8):
    """Frozen visible-only proxy in Tm2/Tm20 order; no UV inference."""
    rgb = np.asarray(rgb8)
    if rgb.dtype != np.uint8 or rgb.shape[-1:] != (3,):
        raise ValueError('Canonical input must be RGB8 samples')
    rgb = rgb.astype(np.float64) / 255
    q = rgb @ np.array(COEFFICIENTS).T
    return q / (q + 0.5)


def inventory(annotations, manifest, matrix, annotation_hash):
    bodies = list(map(int, manifest['bodyIds']))
    if len(set(bodies)) != len(bodies) or matrix.shape != (len(bodies), len(bodies)):
        raise ValueError('Graph identities must be unique and match matrix dimensions')
    if annotations.bodyId.duplicated().any():
        raise ValueError('Annotation identities must be unique')
    expected = next(s['sha256'] for s in manifest['sources'] if s['file'] == 'body-annotations.feather')
    if expected != annotation_hash:
        raise ValueError('Annotation identity differs from graph provenance')
    lookup = {body: index for index, body in enumerate(bodies)}
    selected = annotations[annotations.bodyId.isin(lookup)]
    motor = motor_indices(manifest)
    relays = {lookup[int(row.bodyId)] for row in selected.itertuples()
              if isinstance(row.type, str) and row.type.startswith(('LC', 'LPLC'))} - motor
    if not motor or any(index < 0 or index >= len(bodies) for index in motor):
        raise ValueError('Motor indices must belong to graph')
    relay_paths, readout_paths = paths_to(matrix, relays), paths_to(matrix, motor)
    families = {}
    for family in FAMILIES:
        full = annotations[annotations.type == family]
        retained = selected[selected.type == family]
        cells = []
        for row in retained.sort_values('bodyId').itertuples():
            index = lookup[int(row.bodyId)]
            reasons = []
            if row.superclass != 'ol_intrinsic': reasons.append('not optic-lobe intrinsic')
            if row.somaSide not in ('L', 'R'): reasons.append('missing eye')
            if not all(math.isfinite(v) for v in (row.assignedOlHex1, row.assignedOlHex2)):
                reasons.append('missing finite columns')
            if index in motor: reasons.append('motor readout overlap')
            if relay_paths[1][index] < 1: reasons.append('no directed relay path')
            if readout_paths[1][index] < 1: reasons.append('no directed readout path')
            if family != 'Tm2' and row.flywireType != family:
                reasons.append('unconfirmed cross-dataset type correspondence')
            cells.append(dict(bodyId=str(row.bodyId), index=index, side=row.somaSide,
                              hex=[float(v) if math.isfinite(v) else None for v in (row.assignedOlHex1, row.assignedOlHex2)],
                              flywireType=row.flywireType if isinstance(row.flywireType, str) else None,
                              rejected=reasons, relayPath=witness(index, relay_paths, bodies),
                              readoutPath=witness(index, readout_paths, bodies)))
        families[family] = dict(sourceCount=len(full), retainedCount=len(retained),
            eligibleByEye=dict(Counter(c['side'] for c in cells if not c['rejected'])),
            rejectedReasons=dict(Counter(r for c in cells for r in c['rejected'])),
            sourceBounds={side: {axis: [float(v) if math.isfinite(v) else None for v in
                                      (full.loc[full.somaSide == side, axis].min(), full.loc[full.somaSide == side, axis].max())]
                                 for axis in ('assignedOlHex1', 'assignedOlHex2')} for side in ('L', 'R')},
            cells=cells)
    related = selected[selected.type.fillna('').str.match(r'^(Tm5|Tm20|R[1-8])')]
    return dict(graphHash=manifest['graphHash'], annotationHash=annotation_hash,
        manifestHash=hashlib.sha256(canonical_bytes(manifest)).hexdigest(),
        families=families, relatedExactTypes=related.type.value_counts().sort_index().to_dict(),
        pathScope='Shortest directed paths over nonzero signed retained edges; anatomy only, not response evidence.',
        eligibilityScope='Spatial and directed-path eligibility is independent of spectral response support. No spatial weights assigned.')


def model(report):
    return dict(version=1, status='frozen phenomenological visible-only hypothesis; neural proof pending',
        graphHash=report['graphHash'], annotationHash=report['annotationHash'],
        input='Canonical RGB8 of linear rendered RGB, divided by 255; no sRGB decoding here',
        families=['Tm2', 'Tm20'], rgbCoefficients=COEFFICIENTS,
        transfer='q/(q+0.5)', baseline=0, currentSign='nonnegative injected excitation; graph edge signs unchanged',
        evidence='Tm20 blue-peaked population physiology supports a blue proxy, not these quantitative RGB weights.',
        unsupported='No UV estimate, pale/yellow split, calibrated spectrum, Tm5 input, or isoluminant red/green discrimination.',
        gamut='Rendered RGB unit cube. Only diagnostic luminance and blue are independent neural dimensions.',
        dose=dict(gainMaximum=3, perCellCurrent=[0,3],
            requirement='Slice05 must divide one baseline total visual budget across both families and eyes; no separate full-gain budgets.',
            normalization='Normalize supported spatial columns, apply family allocations within one combined matrix, then one global row scale <=1.',
            totalBound='gain times sum of combined matrix entries; must be <= declared baseline budget for tested supported area.',
            allocationStatus='Numerical spatial allocation and resulting aggregate bound await slice05; this is not an applied current map.'),
        hypotheses=dict(primary='Counterbalance match A/B across two equally supported locations per eye; spatial current pattern changes at equal per-location brightness and equal total channel dose.',
            diagnostic='Uniform match A/B changes blue at equal brightness but changes total dose: diagnostic only.',
            controls=['All visual inputs silenced', 'Chromatic Tm20 branch zeroed, Tm2 unchanged',
                      'Neutral-gray intensity sweep', 'Spatial/color patterns swapped with equal support and total dose',
                      'Same brain seed/state, fixed ticks, exposure and gain; exclude all injected Tm2/Tm20 from readouts'],
            freeze='No coefficient changes after neural experiments; failed proof requires evidence and explicit reslice, never motor tuning.'),
        patches=[dict(name=name, rgb8=rgb, channels=channels(np.array(rgb,dtype=np.uint8)).tolist()) for name,rgb in PATCHES])


def atlas(frozen):
    # SVG patch fills encode linear values for an sRGB display; labels retain canonical bytes.
    elements = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="660" viewBox="0 0 960 660">',
        '<rect width="960" height="660" fill="#f6f7fa"/>',
        '<g font-family="Arial,sans-serif" fill="#172234">',
        '<text x="32" y="38" font-size="24">Visible-color proxy: frozen before neural tests</text>',
        '<text x="32" y="65" font-size="15">Swatches encode linear RGB8 for sRGB display; bars (0–1) are modeled output, not firing.</text>',
        '<text x="32" y="96" font-size="14">Patch / canonical bytes</text>',
        '<text x="420" y="96" font-size="14">Tm2 brightness</text>',
        '<text x="675" y="96" font-size="14">Tm20 blue proxy</text>']
    for i,patch in enumerate(frozen['patches']):
        y=112+i*51
        linear=np.array(patch['rgb8'])/255
        srgb=np.where(linear <= .0031308,12.92*linear,1.055*linear**(1/2.4)-.055)
        fill='#'+''.join(f'{v:02x}' for v in np.rint(srgb*255).astype(int))
        elements += [f'<rect x="32" y="{y}" width="65" height="36" fill="{fill}" stroke="#778197"/>',
            f'<text x="112" y="{y+23}" font-size="15">{patch["name"]}: {patch["rgb8"]}</text>']
        for j,value in enumerate(patch['channels']):
            x=420+j*255
            elements += [f'<rect x="{x}" y="{y+8}" width="150" height="20" fill="#e0e4ed"/>',
                f'<rect x="{x}" y="{y+8}" width="{150*value:.4f}" height="20" fill="#416ab5"/>',
                f'<text x="{x+160}" y="{y+24}" font-size="15">{value:.4f}</text>']
    elements += ['<text x="32" y="600" font-size="14">Match A/B have equal Tm2 output. Swapping their locations preserves total dose.</text>',
        '<text x="32" y="626" font-size="14">No UV. No Tm5 coordinates invented. No hue-calibration or behavioral-success claim.</text>', '</g></svg>']
    return '\n'.join(elements)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--annotations', type=Path, required=True)
    parser.add_argument('--graph', type=Path, default=Path('data/processed/brain'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    graph_path = args.graph / 'graph.bin'
    manifest = json.loads((args.graph / 'manifest.json').read_text())
    if hashlib.sha256(graph_path.read_bytes()).hexdigest() != manifest['graphHash']:
        raise ValueError('Graph binary identity differs from manifest')
    report = inventory(pd.read_feather(args.annotations), manifest, read_binary(graph_path),
                       hashlib.sha256(args.annotations.read_bytes()).hexdigest())
    report['exporterSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'inventory.json').write_bytes(canonical_bytes(report))
    frozen = model(report)
    (args.output / 'color-model.json').write_bytes(canonical_bytes(frozen))
    (args.output / 'channel-atlas.svg').write_text(atlas(frozen))
    print(json.dumps({family: facts['eligibleByEye'] for family, facts in report['families'].items()}, sort_keys=True))


if __name__ == '__main__':
    main()
