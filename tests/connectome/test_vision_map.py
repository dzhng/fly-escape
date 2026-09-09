"""Synthetic map contracts; anatomical and behavioral evidence comes from real data."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import numpy as np
from connectome.vision_map import preferred_angle, overlap_weights


class VisionMapTests(unittest.TestCase):
    def test_modeled_angles_mirror_eyes_without_rounding_to_sectors(self):
        self.assertAlmostEqual(preferred_angle(1., 'R', [0., 8.]), np.pi / 8)
        self.assertAlmostEqual(preferred_angle(1., 'L', [0., 8.]), -np.pi / 8)
        self.assertEqual(preferred_angle(8., 'R', [0., 8.]), np.pi)
        self.assertEqual(preferred_angle(8., 'L', [0., 8.]), -np.pi)

    def test_cosine_overlap_has_neighbor_support_and_no_orthogonal_leak(self):
        weights = overlap_weights(np.arange(8) * np.pi / 4)
        peak = 1 / (1 + np.sqrt(2))
        neighbor = peak / np.sqrt(2)
        np.testing.assert_allclose(weights[0], [peak, neighbor, 0., 0., 0., 0., 0., neighbor], atol=1e-15)
        np.testing.assert_array_equal(weights[0, 2:7], np.zeros(5))
        np.testing.assert_allclose(weights.sum(axis=0), np.ones(8), atol=1e-15)
        np.testing.assert_allclose(weights.sum(axis=1), np.ones(8), atol=1e-15)

    def test_uneven_population_preserves_equal_basis_dose_and_mixed_input_bound(self):
        weights = overlap_weights([*list(np.arange(8) * np.pi / 4), 0., 0.])
        np.testing.assert_allclose(weights.sum(axis=0), np.repeat(weights[:, 0].sum(), 8), atol=1e-14)
        self.assertAlmostEqual(weights.sum(axis=1).max(), 1.)
        self.assertTrue(np.all(weights.sum(axis=1) <= 1. + 1e-12))
        with self.assertRaisesRegex(ValueError, 'empty direction'):
            overlap_weights([0.])
        with self.assertRaisesRegex(ValueError, 'finite'):
            overlap_weights([0., float('nan')])


class ExportTests(unittest.TestCase):
    @staticmethod
    def fixture():
        import pandas as pd
        from scipy import sparse
        rows = []
        for family in ['Tm2', 'Tm20']:
            for side in ['L', 'R']:
                for column in [0., 2., 4., 6., 8.]:
                    rows.append(dict(bodyId=100 + len(rows), type=family, superclass='ol_intrinsic', somaSide=side,
                                     assignedOlHex1=column, assignedOlHex2=1.))
        # A second right-hand middle cell proves normalization corrects unequal populations.
        rows.append(dict(rows[7], bodyId=120))
        rows += [dict(bodyId=121, type='LC4', superclass='visual_projection', somaSide='R', assignedOlHex1=float('nan'), assignedOlHex2=float('nan')),
                 dict(bodyId=122, type='DNx', superclass='descending_neuron', somaSide='R', assignedOlHex1=float('nan'), assignedOlHex2=float('nan'))]
        matrix = sparse.lil_matrix((23, 23))
        matrix[21, :21] = 2.
        matrix[22, 21] = -3.
        manifest = dict(bodyIds=[str(100 + i) for i in range(23)], graphHash='g',
                        sources=[dict(file='body-annotations.feather', sha256='a')],
                        motor=dict(dnL=[], dnR=[22], mnL=[], mnR=[]), pathways={}, groups=[])
        return pd.DataFrame(rows), manifest, matrix.tocsr()

    def test_export_preserves_identity_direction_and_equal_total_basis_dose(self):
        from connectome.vision_map import audit, canonical_bytes
        annotations, manifest, matrix = self.fixture()
        maps, report = audit(annotations, manifest, matrix, 'a')
        mapping = maps['Tm2']
        entries = {entry['index']: entry['weights'] for entry in mapping['entries']}
        self.assertEqual(set(entries), {*range(10), 20})
        self.assertGreater(entries[1][7], 0.)
        self.assertGreater(entries[1][0], 0.)
        self.assertEqual(entries[1][1], 0.)
        self.assertGreater(entries[6][1], 0.)
        self.assertEqual(entries[6][7], 0.)
        weights = np.array(list(entries.values()))
        np.testing.assert_allclose(weights.sum(axis=0), np.repeat(weights[:, 0].sum(), 8), atol=1e-14)
        self.assertAlmostEqual(weights.sum(axis=1).max(), 1.)
        self.assertEqual(report['candidates']['Tm2']['cells'][0]['readoutPath'], ['100', '121', '122'])
        self.assertEqual(report['candidates']['Tm2']['cells'][0]['relayPath'], ['100', '121'])
        self.assertEqual(canonical_bytes(maps), canonical_bytes(audit(annotations.iloc[::-1], manifest, matrix, 'a')[0]))

    def test_missing_path_rejects_cell_and_empty_direction_rejects_candidate(self):
        from connectome.vision_map import audit
        annotations, manifest, matrix = self.fixture()
        matrix = matrix.tolil()
        matrix[21, 1] = 0.
        maps, report = audit(annotations, manifest, matrix.tocsr(), 'a')
        self.assertNotIn(1, [entry['index'] for entry in maps['Tm2']['entries']])
        self.assertIn('no downstream motor-readout path', report['candidates']['Tm2']['cells'][1]['rejected'])
        matrix[21, :5] = 0.
        maps, report = audit(annotations, manifest, matrix.tocsr(), 'a')
        self.assertNotIn('Tm2', maps)
        self.assertIn('empty directions [6]', report['candidates']['Tm2']['rejectionReasons'])
        self.assertIn('Tm20', maps)

    def test_full_source_range_includes_unselected_cells(self):
        import pandas as pd
        from connectome.vision_map import audit
        annotations, manifest, matrix = self.fixture()
        extra = dict(annotations.iloc[0], bodyId=999, assignedOlHex1=16.)
        annotations = pd.concat([annotations, pd.DataFrame([extra])], ignore_index=True)
        _, report = audit(annotations, manifest, matrix, 'a')
        candidate = report['candidates']['Tm2']
        self.assertEqual(candidate['sourceRanges']['L'], [0., 16.])
        self.assertAlmostEqual(candidate['cells'][4]['preferredAngle'], -np.pi / 2)
        self.assertEqual(candidate['sourceCount'], 12)
        self.assertEqual(candidate['selectedCount'], 11)

    def test_motor_overlap_missing_coordinates_and_identity_errors(self):
        from connectome.vision_map import audit
        annotations, manifest, matrix = self.fixture()
        manifest['groups'] = [dict(id='landingL', indices=[1])]
        annotations.loc[2, 'assignedOlHex2'] = float('nan')
        _, report = audit(annotations, manifest, matrix, 'a')
        cells = report['candidates']['Tm2']['cells']
        self.assertIn('motor readout overlap', cells[1]['rejected'])
        self.assertIn('missing finite hex columns', cells[2]['rejected'])
        with self.assertRaisesRegex(ValueError, 'Annotation identity'):
            audit(annotations, manifest, matrix, 'wrong')
        manifest['groups'][0]['indices'] = [999]
        with self.assertRaisesRegex(ValueError, 'Motor readout indices'):
            audit(annotations, manifest, matrix, 'a')
        manifest['bodyIds'][1] = manifest['bodyIds'][0]
        with self.assertRaisesRegex(ValueError, 'identities must be unique'):
            audit(annotations, manifest, matrix, 'a')

    def test_aotu_inventory_does_not_relabel_current_mapped_vision_groups(self):
        from connectome.vision_map import audit
        annotations, manifest, matrix = self.fixture()
        manifest['groups'] = [dict(id='visionL', indices=[0])]
        _, report = audit(annotations, manifest, matrix, 'a')
        self.assertEqual(report['inheritedAotu'], {})

    def test_reverse_reachability_uses_retained_edge_direction_not_undirected_contact(self):
        from scipy import sparse
        from connectome.vision_map import paths_to, witness
        # 0 -> 1 -> 2, but 3 receives from 2 and cannot reach it.
        matrix = sparse.csr_matrix(([2., -3., 4.], ([1, 2, 3], [0, 1, 2])), shape=(4, 4))
        paths = paths_to(matrix, {2})
        self.assertEqual(witness(0, paths, [100, 101, 102, 103]), ['100', '101', '102'])
        self.assertEqual(witness(3, paths, [100, 101, 102, 103]), [])


if __name__ == '__main__':
    unittest.main()
