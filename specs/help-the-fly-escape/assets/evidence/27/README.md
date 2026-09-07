# Sensitivity at anatomical scale

The adopted relative contrast cutoff is **0.01%**, with the existing 0.05 intensity floor and gain-one sensory current unchanged. This is a game-model calibration, not a biological detection threshold. Production graph, neural equations and motor decoding are unchanged.

The previous 5% cutoff missed the smoothly reconstructed anatomical signal. The intermediate 0.1% candidate also missed it. The 0.01% candidate passed the small odor/vision comparison and the following 30-seed confirmation. Each seed averages the two mirrored active-minus-neutral turn differences, signed positive for the expected response. Both starting grid phases are measured separately.

| Pathway | Phase | Signed mean turn difference | Descriptive 95% interval | Positive seed differences |
|---|---:|---:|---|---:|
| Repellent odor | boundary | 0.01282 | 0.01107–0.01457 | 30/30 |
| Repellent odor | centre | 0.01294 | 0.01105–0.01483 | 30/30 |
| Attractive odor | boundary | 0.00804 | 0.00627–0.00981 | 29/30 |
| Attractive odor | centre | 0.00816 | 0.00642–0.00990 | 29/30 |
| Lamp | boundary | 0.00561 | 0.00370–0.00751 | 27/30 |
| Lamp | centre | 0.00678 | 0.00500–0.00856 | 28/30 |
| Shade | boundary | 0.00521 | 0.00344–0.00699 | 27/30 |
| Shade | centre | 0.00574 | 0.00384–0.00765 | 27/30 |

All 960 pathway-silenced comparisons across the two complete matrices match their separately silenced neutral motor/body trajectories exactly, with zero effective injected current. Both side-specific mean differences have the expected signs in every anatomical group. The t(29) intervals are descriptive and unadjusted for multiple comparisons. Seeds 0–29 include the three pilot seeds; this is confirmation over a larger fixed set, not a disjoint holdout or a campaign success estimate.

The visual sampling pair remains a planar bilateral approximation at antenna coordinates, not an eye-optics model. These finite ground-motion probes establish responsiveness, not three-dimensional plume fidelity, accurate biological sensitivity or final level efficacy. Physical dimensions are adopted separately in slice 25.

## Evidence and verification

Compact summaries and compressed raw trajectories retain candidate and confirmation results. The odor candidate summaries explicitly correct their older probe's stale “5%” condition string with the actual cutoff and frozen sensory source. The extended confirmation/vision probe records its sensory source hash directly. Production differs from that candidate only by comments and additional tests in the adapter; its numerical condition is identical.

The sensory seam test pins detectable anatomical-scale differences, mirrored side identity, uniform nonzero neutrality, sub-intensity-floor neutrality and exclusion of motor readout neurons. The new gradient assertion fails with the old cutoff and passes with the calibrated value. Forcing detection on makes the neutral assertions fail; restoring the detector returns green. The 44 environment/body/attempt/placement tests also pass. Independent worker review was unavailable after account usage exhaustion; root reviewed the one-condition production change and all paired/ablation summaries.

`physical_sampling` supports odor/vision groups and 1–30 fixed seeds. The completed confirmation processes were observed exiting zero; no confirmation job remains live. A fresh release WASM build and browser field harness pass mirrored odor, deterministic reset, opposite light/shade, local exit and world-space wind with no browser errors. This checks integration, not anatomical camera alignment. `summarize.py` reproduces the paired report from the raw probe output. No new campaign batch ran.
