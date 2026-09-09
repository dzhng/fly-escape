# Spatial retinal confirmation protocol v3

The fixed [input design](proposal.md) is accepted for protocol preparation.
**Build, freeze and Brain execution remain held until a separate execution
clearance.** Seeds 300–329 are reserved exclusively for this spatial experiment;
they have not been used, selected by response, replaced, or frozen. The passed
v2 color experiment and all v1/v2 evidence remain immutable.

The shared native runner owns every neural step. Use gain 3, the existing graph
and retinal map, unchanged RGB transfer and default frozen LIF parameters. Each
seed uses `Brain::seed_for_fly(seed, 0)`. Every condition starts from native zero
voltage, false spikes and zero refractory state; apply 60 unforced warmup steps
and then 100 measured steps at fixed input. LIF dt remains 1, so the measured
window spans 100 model-time units without a physical-time claim. There is no
body movement or optical feedback.

Before Brain construction, compare all population arrays exactly with the
completed v2 spatial freeze: 438 primary endpoints, 1,176 injected indices,
1,696 motor/readout exclusions, and 40,944 reachable downstream indices. Endpoint
selection, voltage floor, and full population reporting cannot change in
response to these results.

Mean measured membrane voltage is primary; paired per-endpoint spike count is
secondary. Retain two-sided paired Bonferroni 95% simultaneous intervals over
both measures, all 438 endpoints, and all nine primary contrasts: 7,884
comparisons. Each contrast must have at least one corrected voltage interval
wholly beyond ±1e-9 model-voltage units, and every exact/dose control must pass.
Secondary spike intervals use a zero floor and cannot substitute for voltage.
No contrast removal, endpoint replacement, early stopping, optional rerun,
seed replacement, or post-result tolerance adjustment is permitted.

The accepted proposal owns the complete ordered condition, contrast and control
manifest. All nine contrast names and directions are retained. Only the four
uniformly enlarged 64-sample patches and the declared physical floor pair differ
from v2. Their construction, full pose, scene identities and raw RGB are bound
by the accepted proposal and native current evidence; the flight pair remains
unchanged. Input rows permute only within eye/channel, the four patches have
equal delivered dose within 1e-9, and chromatic-off conditions deliver zero Tm20
current. All requested and effective vectors must exactly reproduce the
accepted native oracle before any Brain is created.

Preparation copies the accepted proposal and oracle unchanged. RGB files are
relocated to digest-named paths inside the prepared pack without changing bytes
or condition metadata. Freeze binds these copies, this protocol, the published
compact retinal budget, the final source and manifest identities, the existing
analyzer, and the existing paired-statistics owner. A source or identity mismatch
requires review and a new freeze before execution; it must never be silently
repaired inside a completed experiment.

Use one new write-once spatial output directory. Freeze and run are separate
actions. The existing started marker and streamed report preserve interruption
and prohibit output reuse. Retain the shared runner's per-seed downstream counts,
population aggregates and full/downstream trajectory hashes. Motor values remain
descriptive. A failed primary outcome is preserved as failure; an interrupted
run is preserved as incomplete evidence. Neither native input validation nor
neural propagation constitutes browser/body or physiological-color proof.

The shared analyzer accepts this experiment only as version 3, phase
`spatial-confirmation`, slice 08, with exactly seeds 300–329 and verified reslice
bindings. No v3 color pack is prepared or accepted.
