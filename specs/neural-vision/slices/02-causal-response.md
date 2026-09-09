# 2. Graded input and causal response

Replace the binary vision branch with one map-based adapter. Each bin b delivers per-neuron current `gain * brightness[b]/(brightness[b]+0.5) * normalization[b]` to its declared indices. Gain remains in [0,3]; input is finite/nonnegative. No direct motor targets and no blocked-light values enter the current. Keep odor semantics unchanged. Validate the map once in Graph. The existing manifest owns the selected map and source provenance; graphs without a map reject an enabled visual cue, rather than falling back to the old AOTU winner rule. Existing nonvisual synthetic graphs remain valid.

Use exact basis-bin and mixed-bin tests to pin all eight directions, graded amplitude, finite bounds, equal-dose normalization, zero light, rejection and motor exclusion. Native/TS schema-5 samples remain untouched. Update export-time visual groups from the chosen annotation-derived left/right cells and replace stale AOTU explanations on diagnostic surfaces, leaving About unchanged.

## Pilot and freeze

At most two candidate families × gains 1,2,3 × seeds 1..6. Warm brains for 60 ticks without stimulus; measure 100 ticks at a fixed pose. Use the actual FieldSet sample and adapter, actual graph and unmodified Brain. Dark and uniform controls accompany eight equal-total-brightness angular stimuli. Record the injected-current checksum, input activity, downstream relay activity and existing turn/flight-turn readouts. Equal-total-brightness synthetic basis stimuli are a controlled neural seam check; separately test real lamps through FieldSet.

Choose the candidate/gain with the largest absolute paired t statistic for the real left-versus-right rate-1 lamp difference in either existing turn or flight-turn readout, requiring its pilot 95% paired confidence interval to exclude zero. Report downstream activity separately; it is not an alternate ranking criterion. This criterion is frozen before running the pilot. Do not choose by attraction, escape score or desired turn sign. Break ties by smaller cell population, then lower gain. Save all pilot results and the chosen mapping hash. Freeze before held-out runs. If no candidate has a detectable motor difference, report that failure and reslice; do not change body gains or search additional seeds silently.

## Confirmatory panel

Use held-out seeds 100..129, paired conditions with identical initialization and random streams. Ticks are repeated observations, not independent samples. Save every seed-level result and paired mean/95% t interval.

- Eight basis directions with identical total brightness; compare opposing sectors and require reproducible downstream activity differences, including forward/back distinction. Report sector pairs that remain indistinguishable; do not claim eight-way behavioral decoding.
- Fixed-pose real lamps at left/right and at three fixed rates (0.5,1,2), radius3, distance1, zero ambient. Require graded injected amplitude and a downstream intensity effect between low/high rates. Turning itself need not be monotonic.
- Real visible lamp versus a wall, furniture blocker and matching opening, with pose frozen so collision/motion cannot explain the effect. Blocked light must reproduce the dark neural sample when ambient is zero; the opening restores the visible response.
- Cross light/dark or opposing-direction comparisons with mapped-input silencing. The difference under silencing must be exactly zero for identical recorded sensory/current-independent streams (or explain a floating-point tolerance before running). Silencing must not be interpreted as cessation of spontaneous movement. A matched-count unrelated silencing control must retain at least half the unsilenced directional effect; select control cells deterministically outside mapped inputs, relays and readouts.

Acceptance requires a held-out light-direction difference in downstream activity and at least one unchanged motor readout with 95% paired CI excluding zero; low/high intensity differences; correct optical blocking/opening; and abolition by mapped-input silencing. If claiming a specific intervening relay route, also ablate that relay; otherwise limit the claim to input-dependent graph propagation and show actual paths only as connectivity evidence.

Run a bounded closed-loop, vision-only Attempt panel using the unmodified production body configuration, no odor/food/fan/exit suction and no exit cue. Compare lamp/dark with the same seeds and source-relative initial headings; use resulting trajectories to describe observed approach, avoidance or neither. This is evidence for the next puzzle, not a puzzle acceptance claim. Keep source and starting poses clear of collision. Report production body constants and trajectory metrics rather than borrowing older chamber gains.

## Integration and closeout

Publish the selected manifest map, regenerate only metadata needed for groups and provenance, and copy through the existing brain-asset pipeline. Verify binary hash unchanged. Remove obsolete AOTU injection lists if no remaining owner needs them; no compatibility adapter. Run native/client suites, type checking and WASM/web build. Repeat the 16-fly native throughput comparison with the visual cue enabled, requiring <10% overhead against the same graph/body workload without the new adapter. Measure actual input count and retained archive cap.

Use the real worker to run lamp/intensity/occlusion fixtures with the selected map, and browser playback with sixteen flies through pause, seek and rewind. Preserve actual recorded samples, no underruns in the bounded playback check, and existing panel order. Capture the relevant selected-fly view; compare to prior panel appearance and require a final unprimed screenshot critique. Record all limitations, review the whole diff, consolidate choices, then close-spec before the lighting-puzzle plan.
