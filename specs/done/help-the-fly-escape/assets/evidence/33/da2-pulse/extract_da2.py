"""Scratch DA2 extraction: current extractor plus exact ORN_DA2 / DA2_*PN seeds.

Everything else is preserved: 70000 neuron budget, minimum weight 5, signed
seed-touching edge policy, body-id tie-break, MBON limit, pathway groups.
Reads root sources read-only; writes only under /tmp/fly-da2-circuit-output.
"""
import hashlib, json, sys, time
from pathlib import Path
import pyarrow.feather as feather

ROOT = Path('/Users/david/dev/fly-escape')
OUT = Path('/tmp/fly-da2-circuit-output')
sys.path.insert(0, str(ROOT / 'scripts'))
from connectome import extract as ex
from connectome.download import FILES, hashes
from connectome.artifact import metadata, read_binary, write_binary

start = time.perf_counter()
sources = json.loads((ROOT / 'data/raw/sources.json').read_text())
if len(sources) != len(FILES) or {s['file'] for s in sources} != set(FILES):
    raise ValueError('Provenance must identify all three full-source Feather files')
for source in sources:
    if hashes(ROOT / 'data/raw' / source['file'])[0] != source['sha256']:
        raise ValueError(f"Source checksum mismatch: {source['file']}")

annotations = feather.read_feather(ROOT / 'data/raw/body-annotations.feather')
transmitters = feather.read_feather(ROOT / 'data/raw/body-neurotransmitters.feather')
weights = feather.read_feather(ROOT / 'data/raw/connectome-weights.feather')
print(f'sources loaded {time.perf_counter()-start:.1f}s', flush=True)

baseline = ex.extract(annotations, transmitters, weights)
baseline_hash = write_binary(OUT / 'baseline-graph.bin', baseline['matrix'])
published = json.loads((ROOT / 'data/processed/brain/manifest.json').read_text())
print(f'baseline {time.perf_counter()-start:.1f}s hash={baseline_hash[:16]} '
      f'matchesPublished={baseline_hash == published["graphHash"]}', flush=True)

# The only extraction change: DA2 joins the seeded glomerulus list, so all
# annotated ORN_DA2 and DA2_*PN bodies are seeds like the existing fruit set.
original_fruit = list(ex.FRUIT)
ex.FRUIT = original_fruit + ['DA2']
scratch = ex.extract(annotations, transmitters, weights)
ex.FRUIT = original_fruit
print(f'scratch {time.perf_counter()-start:.1f}s', flush=True)

if (read_binary(OUT / 'baseline-graph.bin') != baseline['matrix']).nnz:
    raise AssertionError('Baseline graph binary round-trip changed incoming currents')
graph_hash = write_binary(OUT / 'graph.bin', scratch['matrix'])
if (read_binary(OUT / 'graph.bin') != scratch['matrix']).nnz:
    raise AssertionError('Graph binary round-trip changed incoming currents')

types = annotations['type'].fillna('').astype(str)
facts = annotations.drop_duplicates('bodyId', keep='last')
da2_types = {'ORN_DA2': 'orn', 'DA2_lPN': 'pn'}
side_of = lambda row: (str(row['rootSide']) if isinstance(row['rootSide'], str) and row['rootSide'] in ('L', 'R')
                       else str(row['somaSide']) if isinstance(row['somaSide'], str) and row['somaSide'] in ('L', 'R')
                       else 'unknown')
lookup = {b: i for i, b in enumerate(scratch['bodies'])}
da2 = {}
for name in da2_types:
    rows = facts.loc[facts['type'].fillna('').astype(str) == name]
    for _, row in rows.iterrows():
        body = int(row['bodyId'])
        key = f'{da2_types[name]}{side_of(row)}'
        entry = da2.setdefault(key, {'type': name, 'side': side_of(row), 'bodies': [], 'indices': []})
        entry['bodies'].append(str(body))
        if body in lookup:
            entry['indices'].append(lookup[body])
for entry in da2.values():
    entry['inGraph'] = len(entry['indices'])
    entry['annotated'] = len(entry['bodies'])

exporter_files = ([ROOT / 'scripts/prepare-graph.py'] + sorted((ROOT / 'scripts/connectome').glob('*.py'))
                  + [ROOT / 'scripts/connectome/pathways.json'])
manifest = dict(schemaVersion=1, dataset='MaleCNS v1.0', synthetic=False, scratch=True,
    attribution=published['attribution'], graphHash=graph_hash,
    exporterHash=hashlib.sha256(b''.join(f.read_bytes() for f in exporter_files)).hexdigest(),
    scratchExtractorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    exporterRevision=published['exporterRevision'], sources=sources,
    extraction=dict(target=70000, minimumWeight=5, edges='seed-touching', tieBreak='body-id-ascending',
                    mbonLimit=200, seededGlomeruli=ex.FRUIT + ['DA2']),
    neuronCount=len(scratch['bodies']), edgeCount=scratch['matrix'].nnz,
    fallbackCount=scratch['fallbackCount'], missingAnnotations=scratch['missingAnnotations'],
    binary=published['binary'], **metadata(scratch, annotations))
(OUT / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':'), sort_keys=True) + '\n')

removed = sorted(set(baseline['bodies']) - set(scratch['bodies']))
added = sorted(set(scratch['bodies']) - set(baseline['bodies']))
da2_bodies = set(map(int, [b for e in da2.values() for b in e['bodies']]))
difference = dict(
    baselineGraphHash=baseline_hash, baselineMatchesPublished=baseline_hash == published['graphHash'],
    publishedGraphHash=published['graphHash'], scratchGraphHash=graph_hash,
    baseline=dict(neurons=len(baseline['bodies']), edges=int(baseline['matrix'].nnz), seeds=len(baseline['seeds'])),
    scratch=dict(neurons=len(scratch['bodies']), edges=int(scratch['matrix'].nnz), seeds=len(scratch['seeds'])),
    edgeDifference=int(scratch['matrix'].nnz - baseline['matrix'].nnz),
    seedDifference=len(scratch['seeds']) - len(baseline['seeds']),
    replacedNeuronCount=len(removed), addedNeuronCount=len(added),
    replacedBodyIds=list(map(str, removed)), addedBodyIds=list(map(str, added)),
    addedThatAreDa2=sorted(str(b) for b in set(added) & da2_bodies),
    addedThatAreNotDa2=sorted(str(b) for b in set(added) - da2_bodies),
    da2InBaseline=sorted(str(b) for b in da2_bodies & set(baseline['bodies'])),
    da2Groups=da2, elapsedSeconds=round(time.perf_counter() - start, 3),
    limits='Neuron-set and edge-count difference only. Retaining a receptor population '
           'does not establish that its input is biologically calibrated or functional.')
(OUT / 'extraction-difference.json').write_text(json.dumps(difference, indent=2) + '\n')
(OUT / 'da2-groups.json').write_text(json.dumps(dict(graphHash=graph_hash, groups=da2), indent=2) + '\n')
print(json.dumps({k: v for k, v in difference.items() if not isinstance(v, (list, dict))}, indent=2))
print(json.dumps({k: dict(annotated=v['annotated'], inGraph=v['inGraph']) for k, v in da2.items()}, indent=2))
