# Open Window exploratory calibration

This checkpoint is **not accepted campaign content**. The current JSON is unfrozen and failed the placement-effect feasibility gate. No 30-seed or held-out evaluation has run. Each report preserves its exact content, content hash, graph identity, paired seeds, outcomes and sampled body positions; earlier candidates remain evidence, not alternative runtime owners.

The native probe runs the real Graph and Attempt with 20 independent flies. It validates positive increasing star thresholds, disjoint 30-seed sets, legal placements through Attempt, and the fixed authored room topology using actual body sweeps. Its topology sampler assumes room IDs 1–4 ordered along +x and pantry 5 above room 2; general campaign topology validation is future work. Counts below 30 are explicitly diagnostic. A single report cannot accept the whole campaign gate.

| Pilot | Reference escapes | Poor escapes | Empty escapes | Verdict |
|---|---|---|---|---|
| Initial straight route | 19/20/20 | 20/20/20 | — | Auto-success; rejected |
| Side window | 0/0/0 | 0/0/0 | — | Wall trapping; rejected |
| Moderate turn | 5 | 3 | — | One-seed signal only |
| Stronger scent | 6/3/5 | 3/1/2 | — | Median gain +3; below +4 |
| Local exit cue | 6/3/5 | 3/2/3 | 2/0/3 | Median gain +2 |
| Gain three | 6 | 3 | 2 | No improvement |
| Longer duration | 6 | 3 | 2 | Extra time did not unstick flies |
| Compact | 7 | 4 | 3 | One-seed gain +3 |
| Compact wrong route | 7/5/5 | 4/5/3 | 3/2/4 | Median gain +2; failed feasibility |
| Heading 0.25 | 11/9/12 | 12/12/11 | 11/10/8 | Median gain −1; easier baseline |
| Heading 0.325 | 7/7/8 | 10/8/8 | 6/7/5 | Median gain −1 |
| Motor diagnostic baseline | 7 | 4 | 3 | Reproduces compact 0.4/gain 2 |
| Turn gain 8 (current JSON) | 5/5/4 | 7/5/6 | 6/8/6 | Median gain −2 versus both controls |

The current gain-8 candidate reaches one star on 3/3 tuning seeds, but that small sample does not establish 27/30 reliability. Empty controls demonstrate some placement benefit without relying solely on a deliberately poor arrangement. The best three-seed gain remains below the required +4. Stalled and boundary-stalled counters plus actual sampled poses expose persistent wall trapping. SVG traces connect sparse samples and must not be interpreted as exact collision paths.

Native first-tick latency was roughly 0.03–0.05 seconds with graph loading measured separately. This is diagnostic evidence, not the browser MVP performance gate; runs overlapped other local work. Browser integration, final visuals, route comprehension and human review remain open.

Run the example with `GRAPH_DIR CONTENT_JSON tuning|heldout COUNT OUTPUT_JSON`, optionally adding `--empty-control`. Held-out execution requires frozen content. The seven malformed-content guards in guard-checks.json passed before graph loading. Parent independently reviewed the real Attempt/Graph ownership and report design; requested threshold and complete-set hardening is included.

## Decisions and next experiment

Geometry was compacted only in this level JSON; the house workbench fixture remains unchanged. Body speeds/turn response, field diffusion, inhibitory odor gain, explicit taste gain, reserve/duration and legal placements use existing validated interfaces. No neural graph, source groups, steering or app UI changed. Thresholds stayed positive at 1/8/15; they were not reduced to manufacture success.

The heading bracket held geometry and both placement sets fixed. Reducing heading to 0.25 raised the empty baseline without improving the reference effect; intermediate 0.325 also failed. Stop angle searching.

The motor diagnostic records actual neural readouts, input/output poses and wrapped heading delta at stalled boundaries (at most eight detailed samples per fly), alongside aggregate turn magnitudes and sparse regular samples. At gain 2, seed 1000 reference mean absolute turn was 0.07908 and maximum 0.36207, below the body clamp of 2. Mean absolute heading change was 0.01582 radians per tick. Gain 8 raised that to 0.05842 and reduced reference boundary-stalled ticks from 9442 to 7984, demonstrating stronger expression of existing neural asymmetry. It nevertheless worsened placement effect; changing gain alone does not solve navigation. No steering, reflection, noise or neuron changes were added.

Current JSON retains the rejected gain-8 candidate with heading 0.4 so its exact last experiment is inspectable. Do not promote it into the app. Pause blind parameter search. The next diagnostic should measure actual left/right sensory contrast and timing, informed by the accepted ahead-cue fixture, before choosing sparse source placement or proposing settled pre-release fields. Any field-settling behavior requires a documented seam and separate evidence; none is implemented here. No held-out seeds may inform tuning. Only a credible pilot signal justifies freezing content and running both complete 30-seed sets.

## Actual cue availability diagnostic

`compact-detector-cold-one.json` reproduces gain-8 seed 1000 outcomes exactly: reference 5, empty 6. This example-only mode uses `--reference-empty`, is limited to at most three seeds and the current single inhibitory odor pathway, and cannot produce campaign acceptance. Activation comes from calling the production `cue_currents` adapter on actual FlyFrame sensory values. Contrast arithmetic and antenna occupancy are annotations, never controller inputs. Antenna coordinates repeat FieldSet.sample's coordinate formula only for Geometry checks; no new layout or detector exists.

Reference adapter activity occurs on 1509/6268 non-boundary-stalled ticks (24.1%) and 4378/7984 boundary-stalled ticks (54.8%). Empty control has zero cue activity. One or both antennae lie outside authored floor on 411 non-boundary ticks and 3279 boundary ticks for reference. Wall mean absolute neural turn is 0.0730 reference versus 0.0779 empty; longest same-sign runs are 32 versus 30 ticks. There is input availability, but the motor magnitude and sign persistence do not show a simple large response over background. This is observational evidence, not a causal neural-circuit claim.

The sparse 50-tick plus terminal samples clarify where contrast occurs. With both antennae on floor, 13/117 non-boundary samples and 22/85 boundary samples activate; median relative contrast is 0.01896 and 0.02395 respectively, below the adapter's 0.05 criterion. With an antenna outside floor, all 16 non-boundary and 69 boundary samples activate and have relative contrast 1. These are sample counts, not all-tick cross-tab estimates. Strong absolute scent can coexist with low interior relative contrast.

The next justified experiment is source sparsity/spacing with the same body and geometry, measuring actual interior cue contrast before expanding seeds. Another agent's separate startup diagnostic reported that joint field settling plus stationary neural warmup worsened both arms; its provenance is separate, and no warmup is included here. No further blind heading/gain or held-out search is justified by this checkpoint.
