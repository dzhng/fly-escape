# Fast retries

Editing and playback share the level's visible world, so retrying does not rebuild the house or reload its artwork. The campaign reuses its client while each attempt starts with fresh simulation state. This removes repeated presentation work without changing neural updates, collision rules, recorded motion or outcomes.

## Why this shape

A player returning from a round needs the same house with an editable arrangement. The level therefore owns that world's lifetime; setup and playback borrow it. Sharing parsed world models between competing owners would make disposal harder to reason about. The roster follows the same ownership principle at its smaller lifetime: downloaded fly bytes can be reused, but each mounted roster owns and releases its parsed graphics resources.

The original retry profile was dominated by rebuilding the world. Retaining it exposed two additional costs. Shared preview materials kept retired WebGL contexts alive through disposal listeners. Separately, a completed-round return regenerated the meadow, with repeated distance calculations dominating its click handler. The preview fix removes the retaining owner; the terrain fix uses one square root after choosing the nearest squared distance. The camera also retains sufficient coverage for its current viewport instead of rebuilding on a narrower panel. A real viewport-size change resets that coverage. One meadow remains live; its fixed cell limit bounds storage. A large inspected footprint can remain coarser until resize.

Parsed graph caching and earlier playback were deliberately excluded. Warm graph construction was smaller than the measured presentation cost, and playback must wait for enough real recorded motion. The [choices ledger](choices.md) records these tradeoffs and the local acceptance limits.

## Invariants

- One mounted level owns its world, canvas and artwork. Exactly one active phase drives its render loop and controls. Leaving the level releases that owner.
- A canceled setup rejects its pending request. Late replies cannot satisfy another level's work. Every attempt retains fresh mutable neural, body, random and recording state.
- The roster releases its parsed model when it closes, including a model whose load completes after unmount. Only immutable downloaded bytes survive the roster.
- Returning to setup clears flies, outcome markers, trails and follow state, and restores the original level camera anchor. Expanded artwork bounds may change fitting, but not that anchor.
- Interrupted playback can redraw its last recorded pose. It cannot invent later motion or call a failed sampler just to repaint icons.
- The existing playback lead, hidden-tab credit and archive limits remain in force. The campaign population, 2/5/10 star thresholds, saved arrangements and About page are unchanged by this feature.

Ownership entry points are [SetupGame](../../../apps/web/src/setup.tsx), [AttemptPlayback](../../../apps/web/src/playback.tsx), [AttemptClient](../../../packages/sim-client/src/attempt-client.ts), [WorldView](../../../packages/game-renderer/src/index.ts), the [preview renderer](../../../packages/game-renderer/src/fly-preview.ts), and its [web hook](../../../apps/web/src/fly-preview.tsx). [Campaign](../../../apps/web/src/campaign.tsx) and [worker](../../../packages/sim-client/src/attempt-worker.ts) own client and attempt lifetime. [Camera tests](../../../packages/game-renderer/src/camera.test.ts) and [client tests](../../../packages/sim-client/src/attempt-client.test.ts) pin the anchor and canceled-request behavior. [Terrain generation](../../../packages/game-renderer/src/exterior-grass.ts) owns the arithmetic optimization.

## Measured acceptance

On local Chrome 152 with ANGLE Metal on an Apple M5 Pro, the final three-seed paired runs recorded median action-to-frame returns of **43.2 ms** in level 1 and **43.4 ms** in level 2. The matching DOM-clock baseline was 320 and 352 ms: **86.5% and 87.7% improvements**, exceeding the 40% target and the 500 ms absolute limit. Final cold setup was 994/1,075 ms, inside the 5 s limit; Start-to-playback ranged from 697–896 ms, inside the first-Start 3 s and subsequent-Start 2 s limits. See the [matched baseline comparison](assets/baseline/dom-comparison.json) and [final paired runs](assets/resources/). The return end point is an editable house; object-thumbnail image decoding can finish afterward. These are local desktop observations, not network or device guarantees.

Both complete real-time rounds passed before the final coverage-retention guard: level 1 ran 6,000 ticks and level 2 ran 3,000, with frame p95 of 17 ms and no underruns. Their returns were 446/311 ms. The final guard changes scenery regeneration only; it was checked with the paired runs above and a complete level-1 Fast-mode diagnostic returning in 40.6 ms. That [final diagnostic](assets/regression/coverage-completed-return/) does not establish real-time pacing. The earlier [complete real-time reports](assets/full/) establish that separate contract.

The [twenty-cycle resource run](assets/resources/twenty-retries.json) covers actual level-1 cancellation/retry cycles. DOM nodes and listeners remained flat; the [collected heap](assets/regression/preview-release.json) retained one world WebGL context after the roster closed. Main-thread heap rose about 1.87 MB over that sample. These observations establish the tested lifecycle bounds, not a universal process-memory ceiling.

Complete seed-42 records match [before](assets/fidelity/before.json) and [after](assets/fidelity/after.json). The [same-worker comparison](assets/fidelity/worker-repeat.json) checks every packed chunk across two complete attempts per level through exactly one worker. [Transport checks](assets/regression/transport.json) cover detached buffers, stale generations, cancellation and hidden-tab credit bounds. [Worker fault recovery](assets/regression/worker-cleanup.json), [interrupted playback](assets/recovery/report.json), and [delayed/failed asset recovery](assets/recovery/asset-lifecycle.json) cover the exercised lifetime failures.

The earlier [548 ms completed-return failure](assets/regression/completed-return/report.json) remains evidence of the problem. Its [diagnostic profile](assets/regression/completed-return-profile.json) located the meadow cost. All six generated geometry hashes (both campaign masks at three tested radii) match [before](assets/regression/meadow-before.json) and [after](assets/regression/meadow-after.json); the arithmetic change does not replace the appearance with a cheaper field. [Local validation](assets/local-validation.txt) records type checking, relevant unit suites, focused terrain/camera checks and independent code-review verdicts.

## Visual provenance

The [original browser baseline](assets/baseline/) captures the production build served locally at `4cb4163`, before this work, on both campaign levels. It defines the house, camera framing, selection and roster appearance to preserve. The [candidate frames](assets/candidate/) and [six paired comparisons](assets/comparison/visual-parity-diff.json) preserve that standard alongside the result. Generated grayscale intermediates are omitted; original frames, comparison metrics and side-by-side images remain.

[Completed rounds](assets/full/), [recovery states](assets/recovery/), [escape-state roster captures from a shortened exit fixture](assets/escape/), [placement states](assets/placement/) and [About layouts](assets/about/) cover the user-visible surfaces. The [final unprimed image review](assets/comparison/final-critique.md) found no introduced defect after thumbnail images decoded. A capture made immediately at editable-house readiness briefly omitted those thumbnails. The lower portion of the scrollable science sidebar can initially fall below its viewport; this also occurs in the baseline. The interruption label in recovery captures is intentional. Telemetry, rather than these still images, establishes timing and playback correctness.

The main visual checkpoint was shown for five minutes without user correction; the reversible decision was to preserve the existing appearance based on paired and independent review. It adds no new visual design direction.
