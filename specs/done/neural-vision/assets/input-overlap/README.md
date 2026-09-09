# Overlapping modeled visual inputs

These maps implement the [bounded overlapping-input revision](../../README.md#why-this-mapping). They keep the original eligible neurons, source ranges, modeled preferred angles and retained graph paths. The runtime representation is one unique entry per neuron with eight nonnegative weights; the [hard-sector maps](../input-map/README.md) remain unchanged historical evidence, not an alternative runtime format.

| Family | Full source | Selected | Included | Effective summed weight per direction |
| --- | ---: | ---: | ---: | ---: |
| Tm2 | 1,766 | 366 | 366 | 30.719128031903 |
| Tm20 | 1,762 | 813 | 810 | 76.416624149146 |

Tm20 excludes the same three cells with missing columns. The [audit](audit.json) contains every selected cell, rejection, preferred angle, directed path witness, source coverage, column sum and maximum row sum. Both corrected candidate objects ([Tm2](Tm2.json), [Tm20](Tm20.json)) retain their graph and annotation identities. Acceptance here means a valid exported projection, not a successful neural or motor experiment.

The projection begins with nonnegative cosine weights around each cell's modeled preferred angle, treating values below `1e-12` as zero. Each direction is divided by its total, then the entire matrix is divided by the largest row total. This gives equal aggregate weights across directions while bounding each cell's mixed-direction input by the global gain, up to floating-point roundoff. Equal aggregate weights do not remove different population sizes, per-cell currents, nonlinear thresholds or anatomical asymmetries; aggregate doses also differ between the two families.

The eye registration remains a **modeled half-circle preferred-angle range**, not a measured field of view or retinal receptive field. Cosine support can extend beyond that range. The [primary eyemap documentation](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/help.html#population-spatial-coverage) supplies column organization, not calibrated world azimuth. The original overlapping motor pilot used a less precise registration description. Comparing its maps from commit `28daa3f` with the corrected maps shows exact JSON equality after removing only `registration`; cells, weights and other identities are unchanged. The pilot's tested hashes remain part of its own evidence.

The [exporter](../../../../../scripts/connectome/vision_map.py) is the single owner of registration and projection. Two independent local exports produced identical maps and audit bytes. Metadata-only publication of each real candidate reproduced the corrected map inside the manifest, retained sixteen groups, and preserved graph bytes and modification time. No production artifact was published during these checks.

All 22 connectome tests pass, including exact-zero cosine support, unequal-population normalization, mixed-input bounds, directional graph reachability, motor exclusion, invalid coordinates and corrupted graph/annotation identities. Removing column normalization caused the unequal-population test to fail; restoring it passed. A separate regression prevents mapped Tm display groups from being mislabeled as unlocalized AOTU populations. Independent Codex review found no actionable Python defects and independently ran the same 22 tests. No neural pilot or motion panel ran as part of this exporter validation.
