# Sensory environment evidence

Status: complete for slice 03; campaign efficacy remains separately gated.

The environment owns geometry, wall-aware odor transport, brightness and local exit cues. The browser draws exported grid values and marks the two sampled antenna positions. It does not compute a second field or infer attraction from a pathway name.

## Neural evidence

[Direct-current controls](neural-probes-no-readout-overlap.json) establish opposite signed responses after excluding neurons used directly by motor readouts. [Continuous bilateral fields](spatial-probes.json), [analog contrast](spatial-contrast-probes.json), and [stronger turning alone](spatial-body-gain-probes.json) did not establish useful paired spatial effects. These failures remain evidence, not accepted tuning.

[Categorical sensing with slower movement](spatial-categorical-slow-probes.json) resolves both mirrored turning and distance differences across 30 matched seeds. The detector chooses a sensory population only from the two local antenna samples. It has no target direction, route, or motor sign correction. Translation is slow enough for neural response to affect the trajectory; the graph, noise and neural update equation are unchanged.

The [ahead-source confirmation](spatial-ahead-probes.json) measures the closest approach before distant walls can dominate an endpoint. Compared with matched no-current controls, excitatory-pathway stimulation increases minimum distance by 0.503 (95% CI 0.354–0.653) on the left and 0.359 (0.209–0.509) on the right. Inhibitory-pathway stimulation decreases it by 0.204 (0.076–0.332) and 0.373 (0.200–0.545). Silencing the stimulated populations removes these differences exactly. These are modeled attraction/avoidance effects, not proof of a natural behavioral role in a living fly.

Confidence intervals use seed-level paired summaries, not individual correlated ticks. The fixtures warm neural state for 60 stationary ticks, then measure 300 moving ticks; campaign startup and robustness remain separate gates. The 10-seed pilots are preliminary subsets, not independent confirmations. [Categorical brightness confirmation](spatial-vision-probes.json) resolves opposite early turning: lamp left-minus-right turn is +0.005079 (95% CI 0.002661–0.007498), shade is −0.004981 (−0.007607 to −0.002355). Both source-facing early alignment contrasts resolve on both sides; uniform-brightness and no-current controls match exactly, and AOTU ablation removes every effect. Closest-distance results remain partly unresolved. Lamp/shade may enter authored experiments; this is not campaign navigation proof. Loom/threat remains unavailable to authors.

## Field and browser checks

Native fixtures check wall/doorway visibility, finite-volume mass and positivity, downwind transport, convergence under grid refinement, and room-local exit cues. Finest doorway grid refinement differs by 1.11%. Browser checks exercise the real graph through WASM/Worker and compare mirrored sampled values, reset identity, light/shade differences, local exit fields, and rotated physical wind. See [browser records](browser.json).

The graph metadata labels now name excitation/inhibition rather than a promised behavior. Regeneration retains binary SHA `6218f74521ca39652c59bd7524fb6aa5fe587058ce438a3fa08e4d8eee7cd454` and all group memberships. Older probes retain their original metadata IDs and manifest hashes. Neuroscience explanations teach voltage, spikes, refractory periods and synapses, and distinguish anatomical wiring from simulated activity.

## Visual review

Earlier critiques found cramped views, small explanation text, overlapping sensor labels, compressed light contrast, and a hidden wind arrow. The candidate uses paired desktop chambers, fixed field scales with numeric samples, raised antenna labels, and an offset world-wind arrow. Pixel comparisons are under `field-comparison/` and `brain-comparison/`; captures are production-route evidence. The final fresh critique inspected all twelve full captures/crops and found no concrete visibility/layout defect. Main-agent inspection agrees. The floor remains behind flies and markers, field contrasts are visible, and the neuron explanations wrap cleanly. The candidate is less wrong than the prior view; all nine matched field/brain captures have nonzero pixel differences (pixelmatch changed fractions 0.082–0.182). Human review opened at 15:47 UTC. After approximately five minutes without a response, the reversible decision is to accept this diagnostic layout based on the production browser checks, pixel comparisons, main-agent inspection and clean fresh critique. Preview is closed; final game framing/art remains later work.

Independent code review caught direct motor overlap in the manual smell slider. Both manual and environmental inputs now share the core sensory-group exclusion and summation path; a focused fixture pins it. The refreshed graph retains identical binary wiring and all memberships. Native tests, production build, typecheck and browser regression pass. The installed Codex CLI cannot review with its configured model (HTTP 400 requiring a newer client); an independent read-only agent review supplies the second opinion while that tool limitation persists.
