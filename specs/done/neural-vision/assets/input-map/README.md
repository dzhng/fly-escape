# Frozen input-map audit

Both bounded candidates pass the anatomical/connectivity gate. This does not choose a behavioral winner.

| Candidate | Full source family | Selected family | Included L / R | Included bins 0–7 | Total current factor per basis bin |
| --- | ---: | ---: | --- | --- | ---: |
| Tm2 | 1,766 | 366 | 128 / 238 | 6, 81, 98, 53, 8, 24, 55, 41 | 6 |
| Tm20 | 1,762 | 813 | 284 / 526 | 13, 167, 188, 147, 16, 75, 120, 84 | 13 |

Tm20 excludes three selected cells with missing assigned columns. Every included cell has a one-edge path to an LC/LPLC relay and a two-edge path to an existing motor readout. The [audit](audit.json) records every selected cell, rejection, source identity, side, columns and directed path witness, plus full-source versus selected spatial coverage. Path direction and nonzero signed edges were checked in the shipped graph. Reachability is structural evidence, not an activity or attraction claim.

The [Tm2](Tm2.json) and [Tm20](Tm20.json) objects are the frozen experiment inputs. Their registration strings contain the exact equation and full-source ranges. The [primary eyemap documentation](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/help.html#population-spatial-coverage) describes ipsilateral column coverage, not a calibrated visual azimuth. Accordingly, using hex1 as horizontal position, its orientation, mirroring and each eye's half-circle field of view are explicit modeled assumptions. Half-bin ties round away from forward symmetrically; bins zero and four include cells from both eyes. No registration should be flipped to obtain a desired response.

Normalization makes equal-brightness basis stimuli deliver equal **summed external current within a candidate**. It does not erase different per-cell currents, population sizes, nonlinear thresholds or asymmetric connectivity. Tm20 and Tm2 also have different minimum counts, so their aggregate doses are not equal to each other at the same global gain. Pilot selection must report this limitation rather than interpreting normalization as biological symmetry.

These historical hard-sector artifacts were produced by `scripts/connectome/vision_map.py` at commit `f669fdd` (the original input-map export). The [current exporter](../../../../../scripts/connectome/vision_map.py) implements the later overlapping projection; use that historical revision to reproduce the hard-sector files. The exporter takes the local annotation Feather, graph directory and output directory, checking source identities before producing candidates. It performs bounded reverse graph traversal once per target set, never a per-frame traversal or graph extraction. The existing graph bytes and production manifest are unchanged by this audit.

Two independent exports produced identical map and audit bytes. All 17 connectome tests passed using the project's Python environment. For a negative control, replacing count normalization with one caused the equal-dose regression to fail; restoring it passed. Independent Codex review found no actionable defects and independently checked all frozen path edges and identities. Its environment lacked NumPy, so the test result comes from the implementation environment rather than that review run.

The [metadata integration checks](../metadata-export/checks.json) verify both frozen candidates can be embedded into temporary copies of the existing manifest, with source-derived bilateral groups and unchanged graph bytes. This prepares publication without choosing a pilot winner.
