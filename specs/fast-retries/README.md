# Fast retries

The player should be able to change a placement and try again without rebuilding the house and reloading its artwork. This is objective 1 of the iteration-and-vision goal. Directional sensing, neural vision, the lighting puzzle and the sensory display are later objectives; each receives its own write-spec and implement-spec pass only after this objective closes.

## Next Agent Prompt

Plan complete, 2026-09-09. Implement the level-lifetime slice, starting with the browser identity/timing regression on the unchanged baseline. The three independent drafts have been synthesized and the plan has passed refactor-clean review. Update this handoff after each committed pass. Do not start vision work until the full acceptance checks and close-spec are complete.

- [x] Finish independent draft synthesis and plan review.
- [ ] [Keep the level world alive](slices/01-level-lifetime.md).
- [ ] Run the combined browser, fidelity, recovery and resource gates below.
- [ ] Review the whole diff, consolidate choices and archive with close-spec.

## Evidence and diagnosis

The [paired baseline](assets/baseline/paired.json) uses the actual production build at `4cb4163`, Chrome 152 on an Apple M5 Pro, a local static origin, both campaign levels and seeds 1, 42 and 100. Initial setup took about 1.2 seconds. Start-to-advancing-playback took 0.95–1.59 seconds and return-to-editable-setup took 0.77–0.87 seconds. An [earlier fresh-browser observation](assets/baseline/exploratory.json) saw 3.1-second setup/start and 1.4–1.9-second returns. These are small local samples, not network or cross-device guarantees. Historical minute-long release waits are not the present baseline.

The setup and playback components each construct, populate and dispose a WorldView on phase changes. HTTP caching does not avoid GLTF parsing, scene allocation and GPU preparation. Their existing worker already survives an attempt, but the campaign first creates a separate catalog worker and each attempt verifies/parses the cached graph bytes again. The current clock deliberately waits for enough recorded lead to sustain real time; its safety policy is not the optimization target.

## Ownership and scope

- The mounted campaign owns one client; each mounted level owns one world and its immutable artwork. Setup and playback borrow those owners. Standalone laboratories own their own resources and use the same contracts.
- Preserve existing per-attempt graph verification and fresh mutable neural/body/random/record state. Graph preparation is not a new cache in this slice; the measured warm construction cost is small relative to rebuilding the world.
- Exactly one active phase drives a world's animation loop and input handlers. Switching level or leaving the campaign releases resources. Async work may attach only to its still-live owner.
- Preserve every neural step, seed interpretation, simulation cadence, collision/outcome rule, 16-fly campaign, 2/5/10 stars, earned progress, saved arrangements and existing About page. No saved-data migration or compatibility scaffolding is needed.
- No speculative attempts during setup, speculative poses during buffering, hidden-tab catch-up, weakened lead policy, frame dropping, graphics redesign, new dependencies or worker pools.

## Acceptance

Measure from real browser actions through an advancing rendered frame or editable setup, not only from React effect entry. Record navigation-to-editable-setup, click-to-attempt-ready, first chunk, assets ready, first advancing frame and retry-confirmation-to-editable-frame. Extend existing report/harness owners rather than adding a separate performance application.

On the identified local desktop production build, test both levels with the same baseline seeds and at least 20 total same-tab retry cycles. Cold browser navigation-to-editable setup must be at most 5 seconds; the first Start at most 3 seconds; subsequent Starts at most 2 seconds; retry confirmation-to-editable-frame at most 500 ms. Paired median return latency must improve by at least 40%. Report all samples and maxima; do not describe a handful of runs as a population p95. Separate cold network transfer from warm browser cache.

Same-level Start/Retry must keep the same world canvas and must not request or reparse world assets. Keep one live worker and one canvas, plateauing retained DOM/resources after warm-up, and the existing archive bound. Check repeated cancel during preparation and production, level switching, failed asset loading and WASM failure recovery. Include actual completed retries as well as early cancellation.

Run one complete real-time attempt per campaign level on an identified hardware renderer: zero underruns, correct final cursor and all terminal outcomes, frame interval p95 at most 25 ms. Preserve pause, hidden-tab credit bounds, rewind, and fast replay's existing semantics. A whole-attempt seeded record comparison must show unchanged data before and after the lifecycle change, including a repeated attempt from the reused worker. Existing transport, client, archive, clock, cleanup and failure tests remain required.

Every visual capture is reviewed with compare-screenshots against the preserved baseline for unintended changes; screenshot-critique is the final unprimed visual check. Timing and cursor telemetry, not still images, establish speed. Human review is non-blocking: show the evidence, allow feedback while continuing independent checks, and record any reversible judgment.

If production throughput or another measured stage prevents a target, reslice that specific bottleneck before changing code. Do not lower the target or change simulation semantics to obtain a green result.

## Research

Three.js documents explicit resource lifetime and the difference between removing objects and disposing their GPU resources in [disposal](https://threejs.org/manual/en/how-to-dispose-of-objects.html) and [cleanup](https://threejs.org/manual/en/cleanup.html). Retain the owning world, rather than sharing disposable scene contents among competing owners.

## Planning synthesis

The fewest-slices and seam-quality drafts independently identified repeated world construction, the catalog-only worker and graph verification. The risk-first Claude draft correctly emphasized separating asset wait from buffer wait and warned that graph caching saves only a small warm cost. Current measurements supersede its historical 39–86-second startup figures. Choose a single world-lifetime change with consumer-level measurements; do not build the proposed multi-entry model cache, graph factory, delivery policy, clock change or neural optimization without a measured need. The alternative single-world design has one resource owner and avoids shared-disposal hazards. The main-thread motion sampler remains a separate pure WASM instance because it serves synchronous rendering; warm it during setup rather than inventing cross-thread sampling.

The refactor-clean review found one coherent missing lifetime: the level's visible world. Moving its lifetime above the phase switch removes repeated ownership rather than adding another asset manager. Campaign client ownership removes the catalog-only worker. The remaining constructor path in the standalone playback lab is intentional ownership for that independently mounted consumer, not a compatibility branch.
