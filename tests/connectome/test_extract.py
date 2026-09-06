"""Small synthetic graphs pin extraction semantics, never biological outcomes."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import pandas as pd
from connectome.extract import extract


class ExtractionTests(unittest.TestCase):
    def test_signed_incoming_edges_and_seed_touching_rule(self):
        annotations = pd.DataFrame({'bodyId': [1, 2, 3, 4], 'type': ['DNa01', 'other', 'other', 'other']})
        transmitters = pd.DataFrame({'body': [1, 2, 3, 4], 'consensus_nt': ['gaba', 'acetylcholine', 'dopamine', None]})
        edges = pd.DataFrame([(1, 2, 9), (2, 1, 7), (3, 1, 8), (4, 1, 5), (2, 4, 99)], columns=['body_pre', 'body_post', 'weight'])
        graph = extract(annotations, transmitters, edges, target=4)
        self.assertEqual(graph['bodies'], [1, 2, 3, 4])
        self.assertEqual(graph['matrix'].toarray().tolist(), [[0, 7, 0, 5], [-9, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
        self.assertEqual(graph['fallbackCount'], 1)


    def test_tied_neighbors_choose_body_id_independent_of_source_order(self):
        annotations = pd.DataFrame({'bodyId': [1, 2, 3], 'type': ['DNx', 'other', 'other']})
        transmitters = pd.DataFrame({'body': [1, 2, 3], 'consensus_nt': ['acetylcholine'] * 3})
        edges = pd.DataFrame([(1, 3, 10), (1, 2, 10)], columns=['body_pre', 'body_post', 'weight'])
        first = extract(annotations, transmitters, edges, target=2)
        second = extract(annotations.iloc[::-1], transmitters, edges.iloc[::-1], target=2)
        self.assertEqual(first['bodies'], [1, 2])
        self.assertEqual(second['bodies'], [1, 2])
        self.assertEqual(first['matrix'].toarray().tolist(), [[0, 0], [10, 0]])

    def test_mbon_truncation_is_stable(self):
        bodies = list(range(1000, 1201))
        annotations = pd.DataFrame({'bodyId': bodies[::-1], 'type': ['MBONx'] * len(bodies)})
        transmitters = pd.DataFrame({'body': bodies, 'consensus_nt': ['acetylcholine'] * len(bodies)})
        edges = pd.DataFrame([], columns=['body_pre', 'body_post', 'weight']).astype('int64')
        graph = extract(annotations, transmitters, edges, target=200)
        self.assertEqual(graph['bodies'], list(range(1000, 1200)))

if __name__ == '__main__':
    unittest.main()
