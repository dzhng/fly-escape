"""Audit modeled eight-sector inputs against annotations and the shipped directed graph.

Run with `PYTHONPATH=scripts python -m connectome.vision_map --help`.
No extraction, graph mutation, neural simulation or behavioral claim occurs here.
"""
import argparse
from collections import Counter, deque
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from connectome.artifact import read_binary

EYEMAP_SOURCE = 'https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/help.html#population-spatial-coverage'


def sector(column, side, bounds):
    """Nearest sector, with exact half-bin ties rounded away from the forward axis."""
    u = (column - bounds[0]) / (bounds[1] - bounds[0])
    nearest = math.floor(4 * u + 0.5)
    return (nearest if side == 'R' else -nearest) % 8


def motor_indices(manifest):
    """Same exclusion union as native sensory::motor_readout_indices."""
    indices = set().union(*map(set, manifest['motor'].values()))
    for name in ['OLFACTORY_DN_LEFT', 'OLFACTORY_DN_RIGHT', 'FLIGHT_DN_LEFT', 'FLIGHT_DN_RIGHT']:
        indices.update(manifest['pathways'].get(name, []))
    for group in manifest['groups']:
        if group['id'] in ['proboscis', 'landingL', 'landingR']:
            indices.update(group['indices'])
    return indices


def paths_to(matrix, targets):
    """Reverse multi-source BFS: each vertex and retained edge is visited at most once.

    Matrix rows are postsynaptic, so a row lists the predecessors of its vertex.
    Sorted targets and CSR indices choose deterministic shortest-path witnesses.
    """
    following = np.full(matrix.shape[0], -1, dtype=np.int64)
    hops = np.full(matrix.shape[0], -1, dtype=np.int64)
    queue = deque(sorted(targets))
    for index in queue:
        following[index], hops[index] = index, 0
    while queue:
        node = queue.popleft()
        for offset in range(matrix.indptr[node], matrix.indptr[node + 1]):
            predecessor = matrix.indices[offset]
            if matrix.data[offset] != 0 and hops[predecessor] < 0:
                following[predecessor], hops[predecessor] = node, hops[node] + 1
                queue.append(int(predecessor))
    return following, hops


def witness(index, paths, bodies):
    following, hops = paths
    if hops[index] < 0:
        return []
    result = [str(bodies[index])]
    for _ in range(int(hops[index])):
        index = int(following[index])
        result.append(str(bodies[index]))
    return result


def canonical_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


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
        bins = [[] for _ in range(8)]
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
            bin_index = sector(row.assignedOlHex1, row.somaSide, ranges[row.somaSide]) if finite and row.somaSide in ranges else None
            if not reasons:
                bins[bin_index].append(index)
            cells.append(dict(bodyId=str(row.bodyId), index=index, type=row.type, superclass=row.superclass,
                              side=row.somaSide if isinstance(row.somaSide, str) else None,
                              hex=[float(v) if math.isfinite(v) else None for v in [row.assignedOlHex1, row.assignedOlHex2]],
                              bin=bin_index, rejected=reasons,
                              relayPath=witness(index, relay_paths, bodies),
                              readoutPath=witness(index, readout_paths, bodies)))
        source_bins = {side: [0] * 8 for side in ranges}
        for row in full.itertuples():
            if row.somaSide in ranges and math.isfinite(row.assignedOlHex1) and math.isfinite(row.assignedOlHex2):
                source_bins[row.somaSide][sector(row.assignedOlHex1, row.somaSide, ranges[row.somaSide])] += 1
        counts = list(map(len, bins))
        rejected = [f'empty bin {i}' for i, count in enumerate(counts) if count == 0]
        accepted_sides = {cell['side'] for cell in cells if not cell['rejected']}
        if accepted_sides != {'L', 'R'}: rejected.append('missing accepted eye')
        registration = ("MODELED, not calibrated retinal azimuth: u=(assignedOlHex1-min)/(max-min) over the full annotated family per somaSide; "
                        "angle=+pi*u for R and -pi*u for L; bin=(sign*floor(4*u+0.5)) mod 8, sign R=+1,L=-1; "
                        "half-bin ties away from forward. Axis, orientation, mirroring and half-circle field of view are assumptions. "
                        f"Source hex1 ranges: L={ranges['L']}, R={ranges['R']}.")
        candidate = dict(accepted=not rejected, rejectionReasons=rejected, sourceCount=len(full), selectedCount=len(selected),
                         sourceSideCounts=full.somaSide.fillna('unknown').value_counts().to_dict(),
                         selectedSideCounts=selected.somaSide.fillna('unknown').value_counts().to_dict(),
                         sourceRanges=ranges, sourceBinCountsBySide=source_bins, binCounts=counts,
                         acceptedBinCountsBySide={side: [sum(c['side'] == side and c['bin'] == i and not c['rejected'] for c in cells) for i in range(8)] for side in ranges},
                         rejectedCellReasons=dict(Counter(reason for c in cells for reason in c['rejected'])), cells=cells)
        if not rejected:
            minimum = min(counts)
            mapping = dict(graphHash=manifest['graphHash'], annotationHash=annotation_hash, family=family, registration=registration,
                           bins=[dict(indices=sorted(indices), normalization=minimum / len(indices)) for indices in bins])
            candidate['mapSha256'] = hashlib.sha256(canonical_bytes(mapping)).hexdigest()
            maps[family] = mapping
        candidates[family] = candidate
    aotu = {}
    for group in manifest['groups']:
        if group['id'] not in ['visionL', 'visionR']: continue
        rows = facts.reindex([bodies[i] for i in group['indices']])
        aotu[group['id']] = dict(count=len(rows), types=rows.type.value_counts().to_dict(),
                                superclasses=rows.superclass.value_counts().to_dict(), sides=rows.somaSide.value_counts().to_dict(),
                                finiteHexCount=int((np.isfinite(rows.assignedOlHex1) & np.isfinite(rows.assignedOlHex2)).sum()),
                                rejection='No assigned optical columns; heterogeneous AOTU groups are not eight spatial sectors')
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
    args = parser.parse_args()
    annotation_hash = hashlib.sha256(args.annotations.read_bytes()).hexdigest()
    graph_hash = hashlib.sha256((args.graph / 'graph.bin').read_bytes()).hexdigest()
    manifest = json.loads((args.graph / 'manifest.json').read_text())
    if manifest['graphHash'] != graph_hash:
        raise ValueError('Graph binary identity differs from manifest')
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
    print('| Candidate | Source | Selected | Eligible bins 0–7 | Verdict |')
    print('| --- | ---: | ---: | --- | --- |')
    for family, result in report['candidates'].items():
        print(f"| {family} | {result['sourceCount']} | {result['selectedCount']} | {result['binCounts']} | {'accepted' if result['accepted'] else '; '.join(result['rejectionReasons'])} |")


if __name__ == '__main__':
    main()
