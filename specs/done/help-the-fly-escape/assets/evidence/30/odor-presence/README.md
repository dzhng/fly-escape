# Bilateral odor-presence candidate

Scratch candidate at b77198b, not integrated. `candidate.patch` changes only odor encoding: below the existing concentration threshold gives no current; equal detectable readings stimulate both sides at one-quarter strength; a detectable gradient stimulates the favored side at full strength and the other at one-quarter. Vision encoding, graph, motor exclusion, positive-current rule and random streams remain unchanged. This is an experimental game encoder, not a physiological claim.

`probe.rs`, `plans.json` and compressed `raw.json.gz` preserve eight full native attempts and direct encoder checks. Both seeds use the current paced second house, 20 flies, 3000 ticks and gain two. No altered production test or setting was adopted.

| Placement | Production 110,111 | Candidate 110,111 |
| --- | --- | --- |
| Empty | 4,3 | 3,4 |
| Corner fan | 1,5 | 7,6 |
| Fan plus rear vinegars | 4,6 | 6,12 |
| Study food only | 0,3 | 5,0 |

The encoder checks verify zero sub-threshold current, bilateral current for equal detectable readings, correct favored side, unchanged vision, and no negative current or motor injection. The existing test expecting a silent non-favored side fails under this candidate; it was intentionally not rewritten. Other simulation library tests pass in scratch.

These two seeds support further investigation, not acceptance. Food-only changes have opposite signs, and even the empty arm contains fixed odor sources. Baselines are reused from the same level/tuning across the exact native-noise optimization; build identity differs. Direct gain-three comparisons reproduce all baseline per-fly aggregates but are not a separate gain-two rerun. The 0.4 m proximity counter is not odor exposure or source footprint. No runtime branch occupancy was measured, so these outcomes cannot isolate the equal-reading branch from the non-favored-side current. Concurrent timings are not performance evidence.

Before adoption, require spatial attraction/repulsion evidence and fresh-seed confirmation. Do not combine this candidate with a decoder change before isolating their effects.
