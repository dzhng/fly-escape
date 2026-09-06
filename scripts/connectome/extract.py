"""Stable visual/motor extraction; matrix rows receive from presynaptic columns."""
import numpy as np
import pandas as pd
from scipy import sparse

SIGNS = {'acetylcholine': 1, 'gaba': -1, 'glutamate': -1, 'histamine': -1,
         'dopamine': 0, 'octopamine': 0, 'serotonin': 0}
FRUIT = ['DM1', 'DM2', 'DM3', 'DM4', 'DM5', 'DL1', 'DL5', 'DC2', 'VA6']


def extract(annotations, transmitters, weights, target=70000, minimum=5):
    types = annotations['type'].fillna('').astype(str)
    bodies_for = lambda mask: set(map(int, annotations.loc[mask, 'bodyId']))
    motor = bodies_for(types.str.upper().str.match(r'^(DN|MN)'))
    lc = bodies_for(types.str.match('^LC'))
    strong = weights.loc[weights['weight'] >= minimum, ['body_pre', 'body_post', 'weight']]
    direct_lc = set(map(int, strong.loc[strong.body_pre.isin(lc) & strong.body_post.isin(motor), 'body_pre']))
    seeds = motor | direct_lc | bodies_for(types.str.contains('LPLC'))
    seeds |= bodies_for(types.str.contains(r'^LH|_LH'))
    for glomerulus in FRUIT:
        seeds |= bodies_for(types.str.startswith(f'ORN_{glomerulus}'))
        seeds |= bodies_for(types.str.contains(f'{glomerulus}_.*PN'))
    mbon = sorted(bodies_for(types.str.startswith('MBON')))[:200]
    seeds |= set(mbon)
    pre_seed, post_seed = strong.body_pre.isin(seeds), strong.body_post.isin(seeds)
    touching = strong.loc[pre_seed | post_seed]
    candidates = pd.concat([
        strong.loc[pre_seed & ~post_seed, ['body_post', 'weight']].rename(columns={'body_post': 'body'}),
        strong.loc[post_seed & ~pre_seed, ['body_pre', 'weight']].rename(columns={'body_pre': 'body'}),
    ])
    ranked = candidates.groupby('body', sort=True).weight.sum().reset_index().sort_values(['weight', 'body'], ascending=[False, True])
    selected = seeds | set(map(int, ranked.body.iloc[:max(0, target - len(seeds))]))
    bodies = sorted(selected)
    lookup = {body: i for i, body in enumerate(bodies)}
    nt_body = 'body' if 'body' in transmitters else 'bodyId'
    nt_name = 'consensus_nt' if 'consensus_nt' in transmitters else 'predicted_nt'
    nt = transmitters.drop_duplicates(nt_body, keep='last').set_index(nt_body)[nt_name].fillna('').astype(str).str.lower()
    labels = nt.reindex(bodies).fillna('')
    signs = {body: SIGNS.get(label, 1) for body, label in zip(bodies, labels)}
    chosen = touching.loc[touching.body_pre.isin(selected) & touching.body_post.isin(selected)]
    edge_signs = chosen.body_pre.map(signs).to_numpy()
    keep = edge_signs != 0
    # Seed-touching edges only: a strong edge between two added neighbors is not admitted.
    matrix = sparse.csr_matrix((chosen.weight.to_numpy()[keep] * edge_signs[keep],
        (chosen.body_post.map(lookup).to_numpy()[keep], chosen.body_pre.map(lookup).to_numpy()[keep])),
        shape=(len(bodies), len(bodies)), dtype=np.float64)
    matrix.sort_indices()
    return dict(bodies=bodies, matrix=matrix, seeds=sorted(seeds), mbon=mbon,
                fallbackCount=int((~labels.isin(SIGNS)).sum()),
                missingAnnotations=len(selected - set(map(int, annotations.bodyId))))
