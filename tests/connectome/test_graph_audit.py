"""Directed graph witnesses retain signed edge direction."""
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))


class GraphAuditTests(unittest.TestCase):
    def test_reverse_reachability_uses_retained_edge_direction_not_undirected_contact(self):
        from scipy import sparse
        from connectome.graph_audit import paths_to, witness
        # 0 -> 1 -> 2, but 3 receives from 2 and cannot reach it.
        matrix = sparse.csr_matrix(([2., -3., 4.], ([1, 2, 3], [0, 1, 2])), shape=(4, 4))
        paths = paths_to(matrix, {2})
        self.assertEqual(witness(0, paths, [100, 101, 102, 103]), ['100', '101', '102'])
        self.assertEqual(witness(3, paths, [100, 101, 102, 103]), [])


if __name__ == '__main__':
    unittest.main()
