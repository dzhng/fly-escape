import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from scipy import sparse
from connectome.artifact import write_binary, read_binary, group_links


class ArtifactTests(unittest.TestCase):
    def test_round_trip_preserves_signed_incoming_current(self):
        matrix = sparse.csr_matrix([[0., -3.5, 0.], [2., 0., 7.], [0., 0., 0.]])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'graph.bin'
            first = write_binary(path, matrix)
            restored = read_binary(path)
            self.assertEqual((restored @ [1., 0., 1.]).tolist(), [0., 9., 0.])
            self.assertEqual((restored @ [0., 1., 0.]).tolist(), [-3.5, 0., 0.])
            self.assertEqual(write_binary(path, restored), first)
            path.write_bytes(path.read_bytes()[:-1])
            with self.assertRaises(ValueError):
                read_binary(path)

    def test_overlapping_groups_count_each_directed_edge_once_per_pair(self):
        matrix = sparse.csr_matrix([[0., -3., 0.], [2., 0., 7.], [0., 0., 0.]])
        links = group_links(matrix, [{'id': 'a', 'indices': [0, 1]}, {'id': 'b', 'indices': [1, 2]}])
        self.assertEqual(links, [
            {'source': 'a', 'target': 'a', 'edgeCount': 2, 'positiveWeight': 2., 'negativeWeight': 3.},
            {'source': 'a', 'target': 'b', 'edgeCount': 1, 'positiveWeight': 2., 'negativeWeight': 0.},
            {'source': 'b', 'target': 'a', 'edgeCount': 2, 'positiveWeight': 7., 'negativeWeight': 3.},
            {'source': 'b', 'target': 'b', 'edgeCount': 1, 'positiveWeight': 7., 'negativeWeight': 0.},
        ])


if __name__ == '__main__':
    unittest.main()
