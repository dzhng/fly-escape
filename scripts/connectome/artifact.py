"""Versioned browser graph format and source-defined grouped connectivity."""
import hashlib
import json
import struct
from pathlib import Path
import numpy as np
from scipy import sparse

MAGIC = b'FLYGRAPH'


def write_binary(path, matrix):
    matrix = matrix.tocsr()
    with path.open('wb') as output:
        output.write(struct.pack('<8sIII', MAGIC, 1, matrix.shape[0], matrix.nnz))
        output.write(matrix.indptr.astype('<u4').tobytes())
        output.write(matrix.indices.astype('<u4').tobytes())
        output.write(matrix.data.astype('<f8').tobytes())
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_binary(path):
    content = path.read_bytes()
    magic, version, n, edges = struct.unpack_from('<8sIII', content)
    if magic != MAGIC or version != 1 or len(content) != 20 + (n + 1) * 4 + edges * 12:
        raise ValueError('Unsupported or truncated graph')
    rows = np.frombuffer(content, '<u4', n + 1, 20)
    indices = np.frombuffer(content, '<u4', edges, 20 + (n + 1) * 4)
    values = np.frombuffer(content, '<f8', edges, 20 + (n + 1 + edges) * 4)
    return sparse.csr_matrix((values, indices, rows), shape=(n, n))


def group_links(matrix, groups):
    links = []
    for source in groups:
        for target in groups:
            weights = matrix[target['indices'], :][:, source['indices']].data
            if len(weights):
                links.append(dict(source=source['id'], target=target['id'], edgeCount=len(weights),
                                  positiveWeight=float(weights[weights > 0].sum()),
                                  negativeWeight=float(-weights[weights < 0].sum())))
    return links


def metadata(graph, annotations):
    lookup = {body: i for i, body in enumerate(graph['bodies'])}
    source = json.loads(Path(__file__).with_name('pathways.json').read_text())
    pathways = {name: ({side: [lookup[b] for b in ids if b in lookup] for side, ids in bodies.items()}
                      if isinstance(bodies, dict) else [lookup[b] for b in bodies if b in lookup])
                for name, bodies in source['bodies'].items()}
    selected = annotations.set_index('bodyId').reindex(graph['bodies'])
    types = selected['type'].fillna('').astype(str).str.upper()
    sides = selected['somaSide'].fillna('').astype(str).str.upper() if 'somaSide' in selected else types * 0
    motor = {}
    for family in ['DN', 'MN']:
        for side in ['L', 'R']:
            mask = types.str.startswith(family) & ((sides == side) | ~sides.isin(['L', 'R']))
            motor[family.lower() + side] = np.flatnonzero(mask.to_numpy()).tolist()
    definitions = [
        ('odorExcL', 'Smell excitation · left', pathways['EXCITATORY_LH_MOTOR']['L']),
        ('odorExcR', 'Smell excitation · right', pathways['EXCITATORY_LH_MOTOR']['R']),
        ('odorInhL', 'Smell inhibition · left', pathways['INHIBITORY_LH_MOTOR']['L']),
        ('odorInhR', 'Smell inhibition · right', pathways['INHIBITORY_LH_MOTOR']['R']),
        ('visionL', 'Vision · left', pathways['AOTU_LEFT']), ('visionR', 'Vision · right', pathways['AOTU_RIGHT']),
        ('turnL', 'Turning · left', pathways['OLFACTORY_DN_LEFT']), ('turnR', 'Turning · right', pathways['OLFACTORY_DN_RIGHT']),
        ('flightL', 'Flight · left', pathways['FLIGHT_DN_LEFT']), ('flightR', 'Flight · right', pathways['FLIGHT_DN_RIGHT']),
        ('landingL', 'Landing · left', pathways['LANDING_DN_LEFT']), ('landingR', 'Landing · right', pathways['LANDING_DN_RIGHT']),
        ('taste', 'Taste', pathways['TARSAL_GRN_IDS'] + pathways['BM_TASTE_IDS']),
        ('feeding', 'Feeding circuit', pathways['GNG_INTERNEURON_IDS']),
        ('proboscis', 'Proboscis motor neurons', pathways['PROBOSCIS_MN_IDS']),
        ('loom', 'Approaching objects', [lookup[int(b)] for b in annotations.loc[annotations.type == 'LC4', 'bodyId'] if int(b) in lookup]),
    ]
    groups = [dict(id=id, label=label, indices=sorted(set(indices))) for id, label, indices in definitions]
    missing = [g['id'] for g in groups if not g['indices']]
    if missing:
        raise ValueError(f'Required pathway groups are empty: {missing}')
    return dict(bodyIds=list(map(str, graph['bodies'])), motor=motor, pathways=pathways, groups=groups,
                groupLinks=group_links(graph['matrix'], groups), pathwayProvenance=source['provenance'])
