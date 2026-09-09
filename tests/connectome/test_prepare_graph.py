"""Exercise metadata-only export through its CLI, with real Feather and graph files."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import pandas as pd
from scipy import sparse
import test_vision_map
from connectome.artifact import write_binary

ROOT = Path(__file__).resolve().parents[2]


class MetadataOnlyTests(unittest.TestCase):
    def test_cli_publishes_one_map_and_source_groups_without_touching_graph_bytes(self):
        annotations, manifest, matrix = test_vision_map.ExportTests.fixture()
        annotations = pd.concat([annotations, pd.DataFrame([
            dict(bodyId=123, type='DNleft', superclass='descending_neuron', somaSide='L'),
            dict(bodyId=124, type='MNproboscis', superclass='motor_neuron', somaSide='R'),
        ])], ignore_index=True)
        matrix = sparse.block_diag((matrix, sparse.csr_matrix((2, 2))), format='csr')
        manifest['bodyIds'] += ['123', '124']
        registry = dict(provenance='synthetic CLI fixture', bodies=dict(
            OLFACTORY_DN_LEFT=[123], OLFACTORY_DN_RIGHT=[122],
            EXCITATORY_LH_MOTOR={'L': [124], 'R': [124]}, INHIBITORY_LH_MOTOR={'L': [124], 'R': [124]},
            FLIGHT_DN_LEFT=[123], FLIGHT_DN_RIGHT=[122], LANDING_DN_LEFT=[123], LANDING_DN_RIGHT=[122],
            TARSAL_GRN_IDS=[124], BM_TASTE_IDS=[124], GNG_INTERNEURON_IDS=[124], PROBOSCIS_MN_IDS=[124]))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = root / 'prepare-graph.py'
            shutil.copyfile(ROOT / 'scripts/prepare-graph.py', script)
            shutil.copytree(ROOT / 'scripts/connectome', root / 'connectome', ignore=shutil.ignore_patterns('__pycache__'))
            (root / 'connectome/pathways.json').write_text(json.dumps(registry))
            source, output = root / 'source', root / 'output'
            source.mkdir()
            output.mkdir()
            annotations.to_feather(source / 'body-annotations.feather')
            manifest['sources'][0]['sha256'] = hashlib.sha256((source / 'body-annotations.feather').read_bytes()).hexdigest()
            manifest.update(graphHash=write_binary(output / 'graph.bin', matrix), neuronCount=25, edgeCount=matrix.nnz,
                            exporterHash='original-extractor', exporterRevision='original-revision', fallbackCount=0, missingAnnotations=0)
            (output / 'manifest.json').write_text(json.dumps(manifest))
            original = (output / 'graph.bin').read_bytes()
            original_mtime = (output / 'graph.bin').stat().st_mtime_ns
            command = [sys.executable, str(script), '--metadata-only', '--vision-family', 'Tm2', '--source', str(source), '--output', str(output)]
            default_command = [value for value in command if value not in ['--vision-family', 'Tm2']]
            missing_selection = subprocess.run(default_command, capture_output=True, text=True, cwd=ROOT)
            self.assertNotEqual(missing_selection.returncode, 0)
            self.assertIn('Choose --vision-family', missing_selection.stderr)
            result = subprocess.run(command, capture_output=True, text=True, cwd=ROOT)
            self.assertEqual(result.returncode, 0, result.stderr)
            published = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(published['visionInput']['family'], 'Tm2')
            groups = {g['id']: g for g in published['groups']}
            self.assertEqual(groups['visionL']['indices'], list(range(5)))
            self.assertEqual(groups['visionR']['indices'], list(range(5, 10)) + [20])
            self.assertEqual(published['extractionExporterHash'], 'original-extractor')
            self.assertNotIn('AOTU_LEFT', published['pathways'])
            self.assertEqual((output / 'graph.bin').read_bytes(), original)
            self.assertEqual((output / 'graph.bin').stat().st_mtime_ns, original_mtime)
            self.assertFalse((output / 'Tm2.json').exists(), 'manifest is the sole production map artifact')
            registry['visionFamily'] = 'Tm2'
            (root / 'connectome/pathways.json').write_text(json.dumps(registry))
            frozen_default = subprocess.run(default_command, capture_output=True, text=True, cwd=ROOT)
            self.assertEqual(frozen_default.returncode, 0, frozen_default.stderr)
            refreshed = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(refreshed['visionInput'], published['visionInput'])
            self.assertEqual(refreshed['extractionExporterHash'], 'original-extractor')
            self.assertEqual((output / 'graph.bin').stat().st_mtime_ns, original_mtime)
            frozen_manifest = (output / 'manifest.json').read_bytes()
            corrupted = bytearray(original)
            corrupted[-1] ^= 1
            (output / 'graph.bin').write_bytes(corrupted)
            bad_graph = subprocess.run(command, capture_output=True, text=True, cwd=ROOT)
            self.assertNotEqual(bad_graph.returncode, 0)
            self.assertIn('Graph binary identity differs', bad_graph.stderr)
            self.assertEqual((output / 'manifest.json').read_bytes(), frozen_manifest)
            (output / 'graph.bin').write_bytes(original)
            annotations.loc[0, 'assignedOlHex1'] += 1.
            annotations.to_feather(source / 'body-annotations.feather')
            rejected = subprocess.run(command, capture_output=True, text=True, cwd=ROOT)
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn('Source checksum mismatch', rejected.stderr)
            self.assertEqual((output / 'manifest.json').read_bytes(), frozen_manifest)


if __name__ == '__main__':
    unittest.main()
