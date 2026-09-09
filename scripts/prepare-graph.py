#!/usr/bin/env python3
"""Prepare graph artifacts, or refresh a selected visual map without rebuilding graph bytes."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import subprocess
import time
import tempfile
import pyarrow.feather as feather
from connectome.download import FILES, download, hashes
from connectome.extract import extract
from connectome.artifact import metadata, read_binary, write_binary
from connectome.retinal_map import trusted_budget, validate_retinal_map
from connectome.graph_audit import canonical_bytes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('data/raw'))
    parser.add_argument('--output', type=Path, default=Path('data/processed/brain'))
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--verify-reference', action='store_true')
    parser.add_argument('--metadata-only', action='store_true', help='Read the existing output graph and update only its manifest and reports')
    parser.add_argument('--retinal-profile', type=Path, default=Path('specs/done/retinal-vision/assets/05/provisional-profile.json'))
    parser.add_argument('--retinal-map', type=Path, help='Validated retinal artifact to publish; full exports default to the committed map')
    args = parser.parse_args()
    registry = json.loads(Path(__file__).with_name('connectome').joinpath('pathways.json').read_text())
    if args.metadata_only and (args.download or args.verify_reference):
        parser.error('--metadata-only cannot download or re-extract reference data')
    start = time.perf_counter()
    if args.metadata_only:
        manifest = json.loads((args.output / 'manifest.json').read_text())
        sources = manifest['sources']
        if hashes(args.output / 'graph.bin')[0] != manifest['graphHash']:
            raise ValueError('Graph binary identity differs from manifest')
        matrix = read_binary(args.output / 'graph.bin')
        graph = dict(bodies=list(map(int, manifest['bodyIds'])), matrix=matrix)
        # Preserve the extraction identity when only metadata is re-exported.
        manifest.setdefault('extractionExporterHash', manifest['exporterHash'])
        manifest.setdefault('extractionExporterRevision', manifest['exporterRevision'])
    else:
        sources = download(args.source) if args.download else json.loads((args.source / 'sources.json').read_text())
        if len(sources) != len(FILES) or {s['file'] for s in sources} != set(FILES):
            raise ValueError('Provenance must identify all three full-source Feather files')
    for source in sources:
        if not args.metadata_only or source['file'] == 'body-annotations.feather':
            if hashes(args.source / source['file'])[0] != source['sha256']:
                raise ValueError(f"Source checksum mismatch: {source['file']}")
    annotation_source = next(s for s in sources if s['file'] == 'body-annotations.feather')
    annotations = feather.read_feather(args.source / 'body-annotations.feather')
    if not args.metadata_only:
        transmitters = feather.read_feather(args.source / 'body-neurotransmitters.feather')
        weights = feather.read_feather(args.source / 'connectome-weights.feather')
        graph = extract(annotations, transmitters, weights)
        with tempfile.TemporaryDirectory() as scratch:
            staged_graph = Path(scratch) / 'graph.bin'
            graph_hash = write_binary(staged_graph, graph['matrix'])
            loaded = read_binary(staged_graph)
            graph_bytes = staged_graph.read_bytes()
        if (loaded != graph['matrix']).nnz:
            raise AssertionError('Graph binary round-trip changed incoming currents')
        previous_mbons = set(list(set(map(int, annotations.loc[annotations['type'].fillna('').str.startswith('MBON'), 'bodyId'])))[:200])
        stable_mbons = set(graph['mbon'])
        manifest = dict(schemaVersion=1, dataset='MaleCNS v1.0', synthetic=False,
            attribution='Janelia FlyEM MaleCNS; https://male-cns.janelia.org/download/ (CC-BY; see source terms)',
            graphHash=graph_hash, sources=sources,
            extraction=dict(target=70000, minimumWeight=5, edges='seed-touching', tieBreak='body-id-ascending', mbonLimit=200),
            neuronCount=len(graph['bodies']), edgeCount=graph['matrix'].nnz,
            fallbackCount=graph['fallbackCount'], missingAnnotations=graph['missingAnnotations'],
            selectionCorrection=dict(mbonRemoved=list(map(str, sorted(previous_mbons - stable_mbons))),
                                     mbonAdded=list(map(str, sorted(stable_mbons - previous_mbons)))),
            binary=dict(magic='FLYGRAPH', version=1, byteOrder='little', rowMeaning='postsynaptic',
                        header='8-byte magic, u32 version, u32 neurons, u32 edges',
                        arrays='u32 rowOffsets[neurons+1], u32 presynapticIndices[edges], f64 weights[edges]'))
    manifest.update(metadata(graph, annotations, source=registry))
    manifest.pop('visionInput', None)
    manifest['retinalBudget'] = registry['retinalBudget']
    trusted_budget(manifest, annotation_source['sha256'])
    retinal_path = args.retinal_map or (args.output / 'retinal-map.json' if args.metadata_only else Path('data/processed/brain/retinal-map.json'))
    retinal_bytes = retinal_path.read_bytes()
    retinal = json.loads(retinal_bytes)
    if retinal_bytes != canonical_bytes(retinal):
        raise ValueError("Retinal artifact must use canonical JSON bytes for native identity validation")
    validate_retinal_map(retinal, manifest, json.loads(args.retinal_profile.read_text()), retinal['colorModel'])
    manifest.update(metadata(graph, annotations, source=registry, retinal_map=retinal))
    exporter_files = [Path(__file__)] + sorted(Path(__file__).with_name('connectome').glob('*.py')) + [Path(__file__).with_name('connectome') / 'pathways.json']
    manifest['exporterHash'] = hashlib.sha256(b''.join(f.read_bytes() for f in exporter_files)).hexdigest()
    manifest['exporterRevision'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    args.output.mkdir(parents=True, exist_ok=True)
    if not args.metadata_only:
        (args.output / 'graph.bin').write_bytes(graph_bytes)
    if retinal_path.resolve() != (args.output / 'retinal-map.json').resolve():
        (args.output / 'retinal-map.json').write_bytes(retinal_bytes)
    (args.output / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':'), sort_keys=True) + '\n')
    summary = {key: manifest[key] for key in ['graphHash', 'exporterHash', 'neuronCount', 'edgeCount', 'fallbackCount', 'missingAnnotations']}
    summary['metadataOnly'] = args.metadata_only
    summary['retinalFamilies'] = ['Tm2', 'Tm20']
    summary['groups'] = {g['id']: len(g['indices']) for g in manifest['groups']}
    summary['seconds'] = round(time.perf_counter() - start, 3)
    if args.verify_reference:
        summary['reference'] = verify_reference(annotations, transmitters, weights, graph)
    (args.output / 'report.json').write_text(json.dumps(summary, indent=2) + '\n')
    (args.output / 'report.html').write_text('<!doctype html><meta charset="utf-8"><title>MaleCNS graph evidence</title><style>body{font:16px/1.5 system-ui;max-width:950px;margin:40px auto;background:#f3f3e9;color:#23413a}pre{white-space:pre-wrap;padding:24px;background:white}h1{font-size:30px}</style><h1>Real MaleCNS graph metadata</h1><p>Source and signed incoming-edge evidence. This is not a browser performance claim.</p><pre>' + html.escape(json.dumps(summary, indent=2)) + '</pre>')
    print(json.dumps(summary, indent=2))


def verify_reference(annotations, transmitters, weights, graph):
    """Run the spike as an independent oracle, with only deterministic selection corrected."""
    import types
    reference_path = Path(__file__).resolve().parents[1] / 'scripts/reference/graph_loader.py'
    source = reference_path.read_text()
    source = source.replace('set(list(olf_bodies["MBON"])[:200])', 'set(sorted(olf_bodies["MBON"])[:200])')
    source = source.replace('key=lambda x: -x[1]', 'key=lambda x: (-x[1], x[0])')
    reference = types.ModuleType('graph_reference')
    exec(compile(source, str(reference_path), 'exec'), reference.__dict__)
    original = reference.VisualMotorGraph(Path('.'))
    original.annotations, original.neurotransmitters, original.weights = annotations, transmitters, weights
    adjacency, _, bodies = original.extract_visual_motor()
    if [int(bodies[i]) for i in range(len(bodies))] != graph['bodies']:
        raise AssertionError('Selected neurons differ from the stabilized spike')
    if (adjacency.T.tocsr() != graph['matrix']).nnz:
        raise AssertionError('Signed edge values differ from the stabilized spike')
    # Report the selection correction independently of graph ordering.
    mbons = original.get_olfactory_pathway_bodies()['MBON']
    previous = set(list(mbons)[:200])
    selected = set(graph['mbon'])
    return dict(allNeuronsEqual=True, allSignedEdgesEqual=True,
                mbonRemoved=list(map(str, sorted(previous - selected))),
                mbonAdded=list(map(str, sorted(selected - previous))),
                oracleSha256=hashlib.sha256(reference_path.read_bytes()).hexdigest(),
                corrections=['sort MBON body IDs before truncation', 'break equal neighbor weights by body ID'])


if __name__ == '__main__':
    main()
