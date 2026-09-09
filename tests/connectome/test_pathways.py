"""The shipped readout registry is checked against source annotations, never silently repaired."""
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import pandas as pd
from scipy import sparse
from connectome.artifact import check_olfactory_readouts, metadata

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = json.loads((ROOT / 'scripts/connectome/pathways.json').read_text())['bodies']
RECORDED = json.loads((Path(__file__).with_name('olfactory-annotations.json')).read_text())['rows']

SYNTHETIC_ANNOTATIONS = [
    {'bodyId': 1, 'type': 'DNp01', 'superclass': 'descending_neuron', 'somaSide': 'L'},
    {'bodyId': 2, 'type': 'DNp02', 'superclass': 'descending_neuron', 'somaSide': 'R'},
    {'bodyId': 3, 'type': 'LHAV2p1', 'superclass': 'cb_intrinsic', 'somaSide': 'R'},
    {'bodyId': 4, 'type': 'LC4', 'superclass': 'visual_projection', 'somaSide': 'R'},
]
SYNTHETIC_REGISTRY = {'provenance': 'synthetic', 'bodies': dict(
    OLFACTORY_DN_LEFT=[1], OLFACTORY_DN_RIGHT=[2],
    EXCITATORY_LH_MOTOR={'L': [3], 'R': [3]}, INHIBITORY_LH_MOTOR={'L': [3], 'R': [3]},
    FLIGHT_DN_LEFT=[1], FLIGHT_DN_RIGHT=[2],
    LANDING_DN_LEFT=[1], LANDING_DN_RIGHT=[2], TARSAL_GRN_IDS=[3], BM_TASTE_IDS=[3],
    GNG_INTERNEURON_IDS=[3], PROBOSCIS_MN_IDS=[3])}


def synthetic_export(readout=None, annotations=None):
    """Export a four-body graph, optionally with an altered right-turn readout or annotation."""
    registry = json.loads(json.dumps(SYNTHETIC_REGISTRY))
    registry['bodies']['OLFACTORY_DN_RIGHT'] = readout or [2]
    graph = dict(bodies=[1, 2, 3, 4], matrix=sparse.csr_matrix(([1.], ([1], [0])), shape=(4, 4)))
    return metadata(graph, pd.DataFrame(annotations or SYNTHETIC_ANNOTATIONS), source=registry)


class ExporterValidationTests(unittest.TestCase):
    def test_descending_candidates_on_their_named_side_export_as_readout_indices(self):
        groups = {group['id']: group['indices'] for group in synthetic_export()['groups']}
        self.assertEqual(groups['turnR'], [1])
        self.assertEqual(groups['turnL'], [0])

    def test_misclassified_candidate_fails_the_export_naming_its_body(self):
        with self.assertRaises(ValueError) as raised:
            synthetic_export(readout=[2, 3])
        self.assertIn('OLFACTORY_DN_RIGHT/3 is cb_intrinsic', str(raised.exception))

    def test_wrong_side_candidate_fails_the_export_naming_its_body(self):
        flipped = [dict(row, somaSide='L') if row['bodyId'] == 2 else row for row in SYNTHETIC_ANNOTATIONS]
        with self.assertRaises(ValueError) as raised:
            synthetic_export(annotations=flipped)
        self.assertIn('OLFACTORY_DN_RIGHT/2 is descending_neuron with soma side L', str(raised.exception))

    def test_unannotated_candidate_fails_instead_of_being_dropped_from_the_readout(self):
        with self.assertRaises(ValueError) as raised:
            synthetic_export(readout=[2, 99])
        self.assertIn('OLFACTORY_DN_RIGHT/99 is unannotated', str(raised.exception))


class ShippedRegistryTests(unittest.TestCase):
    def test_shipped_olfactory_readouts_match_recorded_source_annotations(self):
        check_olfactory_readouts(REGISTRY, pd.DataFrame(RECORDED))

    def test_intrinsic_cell_rejected_as_a_readout_keeps_its_lateral_horn_membership(self):
        self.assertIn(13500, REGISTRY['EXCITATORY_LH_MOTOR']['R'])


class VisualMetadataTests(unittest.TestCase):
    def test_visual_display_groups_follow_map_cells_and_source_sides(self):
        annotations = SYNTHETIC_ANNOTATIONS + [
            {'bodyId': 5 + i, 'type': 'Tm2', 'superclass': 'ol_intrinsic', 'somaSide': 'L' if i % 2 == 0 else 'R'}
            for i in range(8)
        ]
        matrix = sparse.csr_matrix(([7., -4.], ([3, 3], [4, 5])), shape=(12, 12))
        graph = dict(bodies=list(range(1, 13)), matrix=matrix)
        retinal_map = dict(entries=[dict(index=4+i,eye='L' if i%2==0 else 'R',channel=i%2) for i in range(8)])
        result = metadata(graph, pd.DataFrame(annotations), source={**SYNTHETIC_REGISTRY,'retinalBudget': {'weightSum':8}}, retinal_map=retinal_map)
        groups = {group['id']: group for group in result['groups']}
        self.assertEqual(groups['visionL']['indices'], [4, 6, 8, 10])
        self.assertEqual(groups['visionR']['indices'], [5, 7, 9, 11])
        self.assertEqual(groups['visionL']['label'], 'Modeled retina · Tm2 + Tm20 · left')
        self.assertIn(dict(source='visionL', target='loom', edgeCount=1, positiveWeight=7., negativeWeight=0.), result['groupLinks'])
        self.assertEqual(result['retinalBudget'], {'weightSum':8})
        self.assertNotIn('visionInput', result)


if __name__ == '__main__':
    unittest.main()
