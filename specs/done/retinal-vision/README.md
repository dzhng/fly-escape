# Retinal vision

Each fly sees the authored room through paired color cameras. The simulation consumes those samples before its neural tick, and the right-hand eye panels display the exact recorded input during playback, pause and rewind. The existing neuron graph and body dynamics determine what follows; the system does not add exit steering or promise useful navigation.

The user requested shipping the tested capability without further optimization. This closes implementation, **not every research or performance target**. The [release record](assets/11/release/README.md) keeps those limits explicit: full rounds and replay pass, while retry/acquisition latency targets and two spatial confirmation contrasts remain unmet. In two same-seed comparisons, escapes changed from 3→2 and 10→7; that demonstrates changed gameplay outcomes, not better navigation.

## Why it works this way

Color remains a separate modeled input dimension. The retained graph lacks a calibrated screen-RGB response, so brightness drives Tm2 and an explicit blue approximation drives Tm20. Missing source positions remain holes instead of invented anatomy. [Model rationale](assets/04/verification.md), [registration evidence](assets/05/), and the [consolidated choices](choices.md) explain the assumptions the implementation inherits.

The selected profile preserves recognizable boundaries at 128×128 pixels and 721 samples per eye. Canonical RGB bytes avoid a second definition of what the fly saw; exact retention costs a larger archive. The user delegated practical budgets, and the archive cap is 512 MiB. GPU rendering can differ across devices; replay within one archive does not.

## Invariants and owners

- Shared [world construction](../../../packages/game-renderer/src/world-scene.ts) owns appearance. The sensory world is independently owned and excludes presentation overlays, cutaways, other flies and decorative animation. The player camera cannot change neural input.
- [Acquisition](../../../packages/game-renderer/src/retina-capture.ts) uses full native body poses, one bounded batch and one quantization step. [Native attempts](../../../crates/sim/src/attempt.rs) own time and consume a matching batch once before advancing.
- The [retinal map](../../../crates/sim/src/graph/retinal.rs) preserves the source-bound aggregate dose and original artifact text. Neural changes require new model/map identities, not an implicit fallback.
- [Records](../../../crates/sim/src/record.rs) and the [archive](../../../packages/sim-client/src/record.ts) retain consumed bytes. Unsupported or corrupt recordings produce recoverable errors; progress and arrangements remain separate. There is no old directional-vision runtime or compatibility decoder.
- The [client](../../../packages/sim-client/src/attempt-client.ts) owns setup/progress watchdogs and cancellation. Suspension does not consume active GPU waiting time. Retry rebuilds valid ownership instead of supplying stale or black observations.
- [Eye panels](../../../apps/web/src/eye-panels.tsx) read only the selected saved input. The horizontal roster uses existing buttons and selection behavior. The [one-fly workbench](../../../apps/asset-lab/src/retina-attempt.ts) reuses the production producer and supports native reconsumption.

Campaign fly counts, authored timers, scoring, saved arrangements, odor/taste and body dynamics remain intact. Different neural inputs can change trajectories and difficulty.

## Evidence and limits

The pinned reference sampler and its original false-color presentation are retained in the [reference review](assets/01/review.md). They establish the projection/channel comparison; the product retains RGB rather than copying the reference display's discarded red channel. The higher-detail choice follows the user’s rejection of coarse eyes; [optical comparison evidence](assets/02/) preserves the alternatives. [Shared-world evidence](assets/03/verification.md), [record recovery](assets/07/recovery/), and [panel evidence](assets/10/) retain the visual standards and checks.

The [v2 results](assets/08-reslice/results.md) establish the declared color contrast in two contexts. The [v3 result](assets/08-reslice/v3/results.md) preserves a 7/9 spatial pass count and two failed corrected-voltage contrasts. Original negative results, frozen seeds, exact input controls and full lossless reports remain available. No coefficient, gain, endpoint or threshold was changed to make the final outcome pass.

The [paired performance/gameplay comparison](assets/11/baseline-control/measurement/README.md) and [final production checks](assets/11/release/README.md) distinguish observed outcomes from causal or portability claims. Functional source review and its corrections are recorded [here](assets/11/review-fixes/README.md). The [historical contracts](contracts.md) preserve the design targets; the explicit shipping decision above supersedes unfinished optimization/research gates.

Historical evidence preserves its original strings and source fingerprints. Frozen JSON identity keys keep their original names; executable tools resolve the corresponding files at their current archive location. Reproduce a frozen experiment from its recorded commit; archival path corrections in current tooling do not rewrite those frozen bytes. This record is the current release decision, not the old handoff instructions embedded in historical evidence.
