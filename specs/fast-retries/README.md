# Fast retries

The player should be able to change a placement and try again without rebuilding the house and reloading its artwork. This is objective 1 of the iteration-and-vision goal. Directional sensing, neural vision, the lighting puzzle and the sensory display are later objectives; each receives its own write-spec and implement-spec pass only after this objective closes.

## Next Agent Prompt

All behavioral, performance, resource and fidelity gates pass, 2026-09-09. The final matched DOM-clock comparison records 43.2/43.4 ms median returns, improving 86.5/87.7%. The final visual check covers decoded thumbnails, orbit and resize. Finish the final independent image verdict, then archive the reviewed rationale. Do not specify the next objective until closeout is complete.

- [x] Finish independent draft synthesis and plan review.
- [x] Keep the level world alive.
- [x] Release roster preview resources.
- [x] Reduce measured meadow generation cost.
- [x] Reuse sufficient meadow coverage.
- [x] Run combined browser, fidelity, recovery and resource gates.
- [x] Review whole diff and consolidate choices.
- [ ] Archive with close-spec.

## Evidence and diagnosis

The [paired baseline](assets/baseline/paired.json) uses the actual production build at `4cb4163`, Chrome 152 on an Apple M5 Pro, a local static origin, both campaign levels and seeds 1, 42 and 100. Initial setup took about 1.2 seconds. Start-to-advancing-playback took 0.95–1.59 seconds and return-to-editable-setup took 0.77–0.87 seconds. An [earlier fresh-browser observation](assets/baseline/exploratory.json) saw 3.1-second setup/start and 1.4–1.9-second returns. These are small local samples, not network or cross-device guarantees. Historical minute-long release waits are not the present baseline.

Before this change, setup and playback each constructed, populated and disposed a WorldView on phase changes. HTTP caching did not avoid GLTF parsing, scene allocation and GPU preparation. The worker already survived an attempt, but the campaign first created a separate catalog worker. Each attempt still verifies/parses the cached graph bytes. The clock deliberately waits for enough recorded lead to sustain real time; its safety policy is not the optimization target.

The [twenty-retry run](assets/resources/twenty-retries.json) records level-1 cancellation cycles with maximum Start 877.7 ms and return 343.3 ms. Retained DOM nodes and listeners stayed flat. Main-thread heap rose by about 1.87 MB across the sample; this is not evidence of a universal memory ceiling. A [collected-heap inspection](assets/regression/preview-release.json) found one live world WebGL context after the roster closed, versus the [retired previews retained before the fix](assets/regression/preview-retention.json).

Complete seed-42 records for both levels have identical hashes, initial bodies and results [before](assets/fidelity/before.json) and [after](assets/fidelity/after.json). The [transport checks](assets/regression/transport.json) separately cover short repeated worker attempts, detached buffers, cancellation and hidden-tab credit bounds. [Worker fault recovery](assets/regression/worker-cleanup.json) and [producer/renderer recovery](assets/recovery/report.json) pass; [delayed and failed asset-load recovery](assets/recovery/asset-lifecycle.json) also passes.

The six [baseline/candidate comparisons](assets/comparison/visual-parity-diff.json) retain original browser frames and side-by-side images. An unprimed reviewer found no introduced visual defect, including roster reopening, escaped checks and rewind, recovery, placement and About. The selected-fly panel scrolls vertically by design; its initially offscreen lower brain view is also present in the baseline. Completed-attempt captures remain pending. The interrupted-state error label in the recovery images is intentional.

## Ownership and scope

- The mounted campaign owns one client; each mounted level owns one world and its immutable artwork. Setup and playback borrow those owners. Standalone laboratories own their own resources and use the same contracts.
- Preserve existing per-attempt graph verification and fresh mutable neural/body/random/record state. Graph preparation is not a new cache in this slice; the measured warm construction cost is small relative to rebuilding the world.
- Exactly one active phase drives a world's animation loop and input handlers. Switching level or leaving the campaign releases resources. Async work may attach only to its still-live owner.
- Preserve every neural step, seed interpretation, simulation cadence, collision/outcome rule, 16-fly campaign, 2/5/10 stars, earned progress, saved arrangements and existing About page. No saved-data migration or compatibility scaffolding is needed.
- No speculative attempts during setup, speculative poses during buffering, hidden-tab catch-up, weakened lead policy, frame dropping, graphics redesign, new dependencies or worker pools.

## Acceptance

Measure from real browser actions through an advancing rendered frame or editable setup, not only from React effect entry. Record navigation-to-editable-setup, click-to-attempt-ready, first chunk, assets ready, first advancing frame and retry-confirmation-to-editable-frame. Extend existing report/harness owners rather than adding a separate performance application.

On the identified local desktop production build, test both levels with the same baseline seeds and at least 20 total same-tab retry cycles. Cold browser navigation-to-editable setup must be at most 5 seconds; the first Start at most 3 seconds; subsequent Starts at most 2 seconds; retry confirmation-to-editable-frame at most 500 ms. Paired median return latency must improve by at least 40%. Report all samples and maxima; do not describe a handful of runs as a population p95. Separate cold network transfer from warm browser cache.

Same-level Start/Retry must keep the same world canvas and must not request or reparse world assets through the world loaders. Setup palette image elements may remount; report their image requests separately rather than misclassifying them as world reconstruction. Keep one live worker and one canvas, plateauing retained DOM/resources after warm-up, and the existing archive bound. Check repeated cancel during preparation and production, level switching, failed asset loading and WASM failure recovery. Include actual completed retries as well as early cancellation.

Run one complete real-time attempt per campaign level on an identified hardware renderer: zero underruns, correct final cursor and all terminal outcomes, frame interval p95 at most 25 ms. Preserve pause, hidden-tab credit bounds, rewind, and fast replay's existing semantics. A whole-attempt seeded record comparison must show unchanged data before and after the lifecycle change, including a repeated attempt from the reused worker. Existing transport, client, archive, clock, cleanup and failure tests remain required.

Every visual capture is reviewed with compare-screenshots against the preserved baseline for unintended changes; screenshot-critique is the final unprimed visual check. Timing and cursor telemetry, not still images, establish speed. Human review is non-blocking: show the evidence, allow feedback while continuing independent checks, and record any reversible judgment.

If production throughput or another measured stage prevents a target, reslice that specific bottleneck before changing code. Do not lower the target or change simulation semantics to obtain a green result.

## Research

Three.js documents explicit resource lifetime and the difference between removing objects and disposing their GPU resources in [disposal](https://threejs.org/manual/en/how-to-dispose-of-objects.html) and [cleanup](https://threejs.org/manual/en/cleanup.html). Retain the owning world, rather than sharing disposable scene contents among competing owners.

## Planning synthesis

The fewest-slices and seam-quality drafts independently identified repeated world construction, the catalog-only worker and graph verification. The risk-first Claude draft correctly emphasized separating asset wait from buffer wait and warned that graph caching saves only a small warm cost. Current measurements supersede its historical 39–86-second startup figures. Choose a single world-lifetime change with consumer-level measurements; do not build the proposed multi-entry model cache, graph factory, delivery policy, clock change or neural optimization without a measured need. The alternative single-world design has one resource owner and avoids shared-disposal hazards. The main-thread motion sampler remains a separate pure WASM instance because it serves synchronous rendering; warm it during setup rather than inventing cross-thread sampling.

The refactor-clean review found one coherent missing lifetime: the level's visible world. Moving its lifetime above the phase switch removes repeated ownership rather than adding another asset manager. Campaign client ownership removes the catalog-only worker. The remaining constructor path in the standalone playback lab is intentional ownership for that independently mounted consumer, not a compatibility branch.

The twenty-cycle acceptance run exposed a separate preview lifetime defect: the shared parsed preview model retained twenty disposal listeners on each rendered material/geometry, keeping twenty retired preview WebGL contexts alive. The preview slice replaces that GPU-owning cache with immutable bytes and gives each preview renderer ownership of its parsed model. This is a required bounded-resource fix, not a broader artwork change. The same run also exceeded the return latency bound once; final acceptance must rerun both gates after the resource repair.
