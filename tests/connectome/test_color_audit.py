"""Chromatic information and source identity contracts, without neural tuning."""
import sys
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from connectome.color_audit import channels


class ColorTests(unittest.TestCase):
    def test_quantized_matched_brightness_retains_color_and_neutral_matches(self):
        # Exact integer luminance equality: dot([2126,7152,722], [-65,17,23]) = 0.
        a, b = channels(np.array([[100,100,100], [35,117,123]], dtype=np.uint8))
        self.assertAlmostEqual(a[0], b[0], places=15)
        self.assertGreater(b[1], a[1])
        self.assertAlmostEqual(a[0], a[1], places=15)

    def test_spatial_color_swap_preserves_brightness_and_total_channel_dose(self):
        a = np.array([[100,100,100], [35,117,123]], dtype=np.uint8)
        first, swapped = channels(a), channels(a[::-1])
        np.testing.assert_allclose(first[:,0], swapped[:,0], atol=1e-15, rtol=0)
        np.testing.assert_allclose(first.sum(axis=0), swapped.sum(axis=0), atol=1e-15, rtol=0)
        self.assertFalse(np.array_equal(first[:,1], swapped[:,1]))
        self.assertEqual(np.linalg.matrix_rank(channels(np.eye(3, dtype=np.uint8)*255)), 2)

    def test_missing_columns_are_not_replaced_and_directed_witnesses_match(self):
        import pandas as pd
        from scipy import sparse
        from connectome.color_audit import inventory
        rows = [dict(bodyId=1,type='Tm20',flywireType='Tm20',superclass='ol_intrinsic',somaSide='L',assignedOlHex1=2.,assignedOlHex2=3.),
                dict(bodyId=2,type='Tm5c',flywireType='Tm5c',superclass='ol_intrinsic',somaSide='R',assignedOlHex1=float('nan'),assignedOlHex2=float('nan')),
                dict(bodyId=3,type='LC4',flywireType='LC4',superclass='visual_projection',somaSide='L',assignedOlHex1=float('nan'),assignedOlHex2=float('nan')),
                dict(bodyId=4,type='DNx',flywireType=None,superclass='descending_neuron',somaSide='L',assignedOlHex1=float('nan'),assignedOlHex2=float('nan'))]
        matrix = sparse.csr_matrix(([1.,-1.,1.], ([2,2,3],[0,1,2])),shape=(4,4))
        manifest = dict(bodyIds=['1','2','3','4'],graphHash='g',sources=[dict(file='body-annotations.feather',sha256='a')],motor=dict(dnL=[3]),pathways={},groups=[])
        annotations = pd.DataFrame(rows)
        report = inventory(annotations,manifest,matrix,'a')
        self.assertEqual(report['families']['Tm20']['cells'][0]['readoutPath'], ['1','3','4'])
        self.assertEqual(report['families']['Tm5c']['cells'][0]['rejected'], ['missing finite columns'])
        self.assertEqual(report['families']['Tm5c']['eligibleByEye'], {})
        with self.assertRaisesRegex(ValueError,'provenance'):
            inventory(annotations,manifest,matrix,'wrong')
        reversed_report = inventory(annotations.iloc[::-1],manifest,matrix.T.tocsr(),'a')
        self.assertIn('no directed readout path',reversed_report['families']['Tm20']['cells'][0]['rejected'])
