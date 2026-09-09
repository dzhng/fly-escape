"""Bounded directed graph witnesses and canonical artifact identities."""
from collections import deque
import json
import numpy as np

def motor_indices(manifest):
    """Same exclusion union as native sensory::motor_readout_indices."""
    indices = set().union(*map(set, manifest['motor'].values()))
    for name in ['OLFACTORY_DN_LEFT', 'OLFACTORY_DN_RIGHT', 'FLIGHT_DN_LEFT', 'FLIGHT_DN_RIGHT']:
        indices.update(manifest['pathways'].get(name, []))
    for group in manifest['groups']:
        if group['id'] in ['proboscis', 'landingL', 'landingR']:
            indices.update(group['indices'])
    return indices


def paths_to(matrix, targets):
    """Reverse multi-source BFS: each vertex and retained edge is visited at most once.

    Matrix rows are postsynaptic, so a row lists the predecessors of its vertex.
    Sorted targets and CSR indices choose deterministic shortest-path witnesses.
    """
    following = np.full(matrix.shape[0], -1, dtype=np.int64)
    hops = np.full(matrix.shape[0], -1, dtype=np.int64)
    queue = deque(sorted(targets))
    for index in queue:
        following[index], hops[index] = index, 0
    while queue:
        node = queue.popleft()
        for offset in range(matrix.indptr[node], matrix.indptr[node + 1]):
            predecessor = matrix.indices[offset]
            if matrix.data[offset] != 0 and hops[predecessor] < 0:
                following[predecessor], hops[predecessor] = node, hops[node] + 1
                queue.append(int(predecessor))
    return following, hops


def witness(index, paths, bodies):
    following, hops = paths
    if hops[index] < 0:
        return []
    result = [str(bodies[index])]
    for _ in range(int(hops[index])):
        index = int(following[index])
        result.append(str(bodies[index]))
    return result


def canonical_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


