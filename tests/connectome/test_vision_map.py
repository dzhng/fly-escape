"""Synthetic map contracts; anatomical and behavioral evidence comes from real data."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from connectome.vision_map import sector


class VisionMapTests(unittest.TestCase):
    def test_modeled_registration_mirrors_eyes_and_keeps_forward_back_shared(self):
        self.assertEqual([sector(x, 'R', [0., 8.]) for x in range(0, 9, 2)], [0, 1, 2, 3, 4])
        self.assertEqual([sector(x, 'L', [0., 8.]) for x in range(0, 9, 2)], [0, 7, 6, 5, 4])
        self.assertEqual(sector(1., 'R', [0., 8.]), 1)
        self.assertEqual(sector(1., 'L', [0., 8.]), 7)


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
        self.assertEqual([len(b['indices']) for b in mapping['bins']], [2, 1, 2, 1, 2, 1, 1, 1])
        self.assertEqual(mapping['bins'][7]['indices'], [1])
        self.assertEqual(mapping['bins'][1]['indices'], [6])
        self.assertEqual([len(b['indices']) * b['normalization'] for b in mapping['bins']], [1.] * 8)
        self.assertEqual(report['candidates']['Tm2']['cells'][0]['readoutPath'], ['100', '121', '122'])
        self.assertEqual(report['candidates']['Tm2']['cells'][0]['relayPath'], ['100', '121'])
        self.assertEqual(canonical_bytes(maps), canonical_bytes(audit(annotations.iloc[::-1], manifest, matrix, 'a')[0]))

    def test_missing_path_rejects_cell_and_empty_bin_rejects_candidate(self):
        from connectome.vision_map import audit
        annotations, manifest, matrix = self.fixture()
        matrix = matrix.tolil()
        matrix[21, 1] = 0.
        maps, report = audit(annotations, manifest, matrix.tocsr(), 'a')
        self.assertNotIn('Tm2', maps)
        self.assertIn('empty bin 7', report['candidates']['Tm2']['rejectionReasons'])
        self.assertIn('no downstream motor-readout path', report['candidates']['Tm2']['cells'][1]['rejected'])
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
        self.assertEqual(candidate['cells'][4]['bin'], 6)
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
