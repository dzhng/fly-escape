"""Audit modeled overlapping directional inputs against annotations and the shipped directed graph.

Run with `PYTHONPATH=scripts python -m connectome.vision_map --help`.
No extraction, graph mutation, neural simulation or behavioral claim occurs here.
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

EYEMAP_SOURCE = 'https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/help.html#population-spatial-coverage'


def preferred_angle(column, side, bounds):
    """The frozen modeled hex1 projection; no calibrated retinal azimuth is implied."""
    u = (column - bounds[0]) / (bounds[1] - bounds[0])
    return (1 if side == 'R' else -1) * math.pi * u


def cosine_lobes(angles):
    angles = np.asarray(angles, dtype=np.float64)
    if angles.ndim != 1 or not np.isfinite(angles).all():
        raise ValueError('Preferred angles must be a finite vector')
    raw = np.maximum(0., np.cos(angles[:, None] - np.arange(8) * math.pi / 4))
    raw[raw < 1e-12] = 0.
    return raw


def overlap_weights(angles):
    """Equal column dose followed by one global scale bounding every row's total."""
    raw = cosine_lobes(angles)
    totals = raw.sum(axis=0)
    empty = np.flatnonzero(totals == 0).tolist()
    if empty:
        raise ValueError(f'empty directions {empty}')
    weights = raw / totals
    return weights / weights.sum(axis=1).max()


def audit(annotations, manifest, matrix, annotation_hash):
    bodies = list(map(int, manifest['bodyIds']))
    if len(bodies) != len(set(bodies)) or matrix.shape != (len(bodies), len(bodies)):
        raise ValueError('Graph body identities must be unique and match its matrix dimensions')
    if annotations.bodyId.duplicated().any():
        raise ValueError('Annotation body identities must be unique')
    source = next(s for s in manifest['sources'] if s['file'] == 'body-annotations.feather')
    if source['sha256'] != annotation_hash:
        raise ValueError('Annotation identity differs from graph provenance')
    lookup = {body: index for index, body in enumerate(bodies)}
    facts = annotations.set_index('bodyId')
    motor = motor_indices(manifest)
    if not motor or any(i < 0 or i >= len(bodies) for i in motor):
        raise ValueError('Motor readout indices must be nonempty and belong to this graph')
    relays = {lookup[int(row.bodyId)] for row in annotations.itertuples()
              if int(row.bodyId) in lookup and isinstance(row.type, str)
              and row.type.startswith(('LC', 'LPLC'))} - motor
    readout_paths = paths_to(matrix, motor)
    relay_paths = paths_to(matrix, relays)
    maps, candidates = {}, {}
    for family in ['Tm2', 'Tm20']:
        full = annotations[annotations.type == family]
        selected = full[full.bodyId.isin(lookup)]
        ranges = {}
        for side in ['L', 'R']:
            columns = full.loc[full.somaSide == side, 'assignedOlHex1']
            columns = columns[np.isfinite(columns)]
            if len(columns) == 0 or columns.min() == columns.max():
                raise ValueError(f'{family}/{side}: no finite nondegenerate source column range')
            ranges[side] = [float(columns.min()), float(columns.max())]
        cells = []
        for row in selected.sort_values('bodyId').itertuples():
            index = lookup[int(row.bodyId)]
            finite = math.isfinite(row.assignedOlHex1) and math.isfinite(row.assignedOlHex2)
            reasons = []
            if row.superclass != 'ol_intrinsic': reasons.append('not optic-lobe intrinsic')
            if row.somaSide not in ranges: reasons.append('missing L/R soma side')
            if not finite: reasons.append('missing finite hex columns')
            if index in motor: reasons.append('motor readout overlap')
            if readout_paths[1][index] < 1: reasons.append('no downstream motor-readout path')
            if relay_paths[1][index] < 1: reasons.append('no downstream LC/LPLC relay path')
            angle = preferred_angle(row.assignedOlHex1, row.somaSide, ranges[row.somaSide]) if finite and row.somaSide in ranges else None
            cells.append(dict(bodyId=str(row.bodyId), index=index, type=row.type, superclass=row.superclass,
                              side=row.somaSide if isinstance(row.somaSide, str) else None,
                              hex=[float(v) if math.isfinite(v) else None for v in [row.assignedOlHex1, row.assignedOlHex2]],
                              preferredAngle=angle, rejected=reasons,
                              relayPath=witness(index, relay_paths, bodies),
                              readoutPath=witness(index, readout_paths, bodies)))
        source_support = {}
        for side in ranges:
            angles = [preferred_angle(row.assignedOlHex1, side, ranges[side]) for row in full.itertuples()
                      if row.somaSide == side and math.isfinite(row.assignedOlHex1) and math.isfinite(row.assignedOlHex2)]
            source_support[side] = (cosine_lobes(angles) > 0).sum(axis=0).tolist()
        included = [cell for cell in cells if not cell['rejected']]
        rejected = []
        if {cell['side'] for cell in included} != {'L', 'R'}:
            rejected.append('missing accepted eye')
        try:
            weights = overlap_weights([cell['preferredAngle'] for cell in included])
        except ValueError as error:
            rejected.append(str(error))
            weights = None
        registration = ("MODELED, not calibrated retinal azimuth or measured receptive fields: "
                        "u=(assignedOlHex1-min)/(max-min) over the full annotated family per somaSide; "
                        "angle=+pi*u for R and -pi*u for L. "
                        "raw[i,b]=max(0,cos(angle_i-b*pi/4)); raw<1e-12 becomes zero; "
                        "divide each column by its sum, then the entire matrix by its largest row sum. "
                        "Axis, orientation, mirroring and half-circle preferred-angle range are assumptions. "
                        f"Source hex1 ranges: L={ranges['L']}, R={ranges['R']}.")
        candidate = dict(accepted=not rejected, rejectionReasons=rejected, sourceCount=len(full), selectedCount=len(selected),
                         includedCount=len(included),
                         sourceSideCounts=full.somaSide.fillna('unknown').value_counts().to_dict(),
                         selectedSideCounts=selected.somaSide.fillna('unknown').value_counts().to_dict(),
                         sourceRanges=ranges, sourceDirectionCountsBySide=source_support,
                         rejectedCellReasons=dict(Counter(reason for c in cells for reason in c['rejected'])), cells=cells)
        if not rejected:
            mapping = dict(graphHash=manifest['graphHash'], annotationHash=annotation_hash, family=family, registration=registration,
                           entries=[dict(index=cell['index'], weights=row.tolist()) for cell, row in zip(included, weights)])
            candidate.update(columnWeightSums=weights.sum(axis=0).tolist(),
                             effectivePopulationPerDirection=float(weights.sum(axis=0).mean()),
                             maximumRowSum=float(weights.sum(axis=1).max()),
                             directionCounts=(weights > 0).sum(axis=0).tolist(),
                             includedDirectionCountsBySide={side: (weights[[c['side'] == side for c in included]] > 0).sum(axis=0).tolist() for side in ranges})
            candidate['mapSha256'] = hashlib.sha256(canonical_bytes(mapping)).hexdigest()
            maps[family] = mapping
        candidates[family] = candidate
    aotu = {}
    selected_facts = facts.reindex(bodies)
    aotu_cells = selected_facts[selected_facts.type.fillna('').str.startswith('AOTU')]
    for side in ['L', 'R']:
        rows = aotu_cells[aotu_cells.somaSide == side]
        if rows.empty:
            continue
        aotu[side] = dict(count=len(rows), types=rows.type.value_counts().to_dict(),
                          superclasses=rows.superclass.value_counts().to_dict(), sides=rows.somaSide.value_counts().to_dict(),
                          finiteHexCount=int((np.isfinite(rows.assignedOlHex1) & np.isfinite(rows.assignedOlHex2)).sum()),
                          selection='Selected source-annotated AOTU types on the named soma side, independent of current display groups',
                          rejection='No assigned optical columns; heterogeneous AOTU populations are not directional input coordinates')
    return maps, dict(annotationHash=annotation_hash, graphHash=manifest['graphHash'],
                      eyemapSource=EYEMAP_SOURCE, registrationEvidence='The documentation describes ipsilateral hexagonal column coverage, not calibrated visual azimuth.',
                      motorExclusionCount=len(motor), relayTargetCount=len(relays),
                      pathScope='Shortest directed witnesses in shipped signed CSR; nonzero edges of either sign count. Reachability does not establish neural response.',
                      candidates=candidates, inheritedAotu=aotu)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--annotations', type=Path, required=True)
    parser.add_argument('--graph', type=Path, default=Path('data/processed/brain'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--profile', type=Path, help='Explicit provisional retinal profile; requires --color-model')
    parser.add_argument('--color-model', type=Path, help='Frozen source-bound color model for retinal export')
    args = parser.parse_args()
    if bool(args.profile) != bool(args.color_model):
        parser.error('--profile and --color-model are required together')
    annotation_hash = hashlib.sha256(args.annotations.read_bytes()).hexdigest()
    graph_hash = hashlib.sha256((args.graph / 'graph.bin').read_bytes()).hexdigest()
    manifest = json.loads((args.graph / 'manifest.json').read_text())
    if manifest['graphHash'] != graph_hash:
        raise ValueError('Graph binary identity differs from manifest')
    if args.profile:
        from connectome.retinal_map import export_retinal
        export_retinal(pd.read_feather(args.annotations), manifest, read_binary(args.graph / 'graph.bin'),
                       annotation_hash, json.loads(args.profile.read_text()), json.loads(args.color_model.read_text()), args.output)
        return
    maps, report = audit(pd.read_feather(args.annotations), manifest, read_binary(args.graph / 'graph.bin'), annotation_hash)
    report['exporterSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    args.output.mkdir(parents=True, exist_ok=True)
    for family in ['Tm2', 'Tm20']:
        path = args.output / f'{family}.json'
        if family in maps:
            path.write_bytes(canonical_bytes(maps[family]))
        else:
            path.unlink(missing_ok=True)
    (args.output / 'audit.json').write_bytes(canonical_bytes(report))
    print('| Candidate | Source | Selected | Included | Effective population/direction | Verdict |')
    print('| --- | ---: | ---: | ---: | ---: | --- |')
    for family, result in report['candidates'].items():
        print(f"| {family} | {result['sourceCount']} | {result['selectedCount']} | {result['includedCount']} | {result.get('effectivePopulationPerDirection', 0):.12f} | {'accepted' if result['accepted'] else '; '.join(result['rejectionReasons'])} |")


if __name__ == '__main__':
    main()
