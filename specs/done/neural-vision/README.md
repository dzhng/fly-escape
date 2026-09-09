# Directional light through the neural circuit

The simulation sends coarse directional brightness through an annotation-derived visual input map and the retained MaleCNS circuit. Controlled experiments establish downstream responses to direction and intensity, optical blocking, and removal of those responses by input silencing. They do **not** establish attraction, avoidance or a useful lighting puzzle.

## Why this mapping

The [official MaleCNS downloads](https://male-cns.janelia.org/download/) and [Cell Type Explorer](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/) establish source identity and visual cell annotations. The explorer's [column documentation](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/help.html#population-spatial-coverage) describes optic-lobe coordinates, not calibrated world angles. No FlyWire body identities or retinal registration are imported.

The selected graph omits retinal R1–R8 cells and keeps seed-touching edges rather than the full induced circuit. Its prior AOTU display populations lack optical column assignments. Retained Tm2 and Tm20 cells provide column annotations and downstream connectivity witnesses. [The annotation audit](assets/input-map/README.md) records those distinctions; a retained path alone is never treated as a measured response.

The production map uses the smaller audited Tm2 population. It was selected by population size for a separately preregistered neural confirmation after every motor pilot failed, not as a successful steering candidate. Hex-column registration, overlapping cosine receptive fields, positive brightness current and brightness compression are modeling assumptions. [The projection rationale](assets/input-overlap/README.md) records the limits and exact map identities. This is neither complete biological vision nor a calibrated retinal model.

## Boundaries that matter

The [offline exporter](../../../scripts/connectome/vision_map.py) owns the source-to-input mapping. The graph manifest is the only runtime map; the [loader](../../../crates/sim/src/graph.rs) resolves and validates it once. Source and graph identities, existing non-motor indices, nonnegative bounded weights and equal directional dose prevent accidental changes to the modeled input budget. Original extraction provenance survives metadata publication, and graph bytes remain unchanged.

The [sensory adapter](../../../crates/sim/src/sensory.rs) consumes brightness only. Blocked-light telemetry, exit bearings, camera state and odor do not become visual current. Existing neural dynamics and body decoding remain unchanged. The visual map and current reach movement through Brain; they cannot directly command a turn. An enabled visual cue requires a map, while nonvisual synthetic graphs remain usable.

Directional sensing and replay retain the [recorded-sample contract](../directional-vision/README.md). Publishing new visual display groups changes their anatomical membership, not the campaign's authored body settings, timers, population or star thresholds. The existing campaign still has vision disabled at this checkpoint; decorative wall lights are not simulation sources. That incomplete gameplay integration is explicit, not evidence that vision leaves difficulty unchanged.

## Evidence and rejected approaches

[The neural confirmation](assets/neural-confirmation/README.md) preserves its pre-run freeze, exact sources, every seed result and independent analysis. All seven prespecified contrasts pass simultaneous Bonferroni intervals across 847 comparisons: four opposing directional pairs, a real left/right lamp comparison and high/low intensity on each side. All 26 optical, graded-current, trajectory-equality and sham checks pass. Input-silenced stimuli reproduce the dark-inputs neural trajectory; wall/furniture reproduce dark, and the opening restores the visible source.

The endpoint is the whole frozen downstream path-witness population, excluding injected cells and movement readouts. This supports graph propagation, not a uniquely identified biological relay route. The zero-outgoing sham only checks the silencing machinery; it does not establish specificity against arbitrary connected-cell ablation. The [analyzer](../../../scripts/connectome/analyze_neural_vision.py) owns multiplicity and exact-control acceptance.

The [hard-sector pilot](assets/experiments), [DNp03 diagnostic](assets/readout-diagnostic) and [overlapping-input motor pilot](assets/experiments-overlap) did not establish a supported motor response or replacement readout. No decoder change was made. The original spec mistakenly made motor significance a prerequisite for the neural objective; an explicit preregistration separated those questions before consuming held-out seeds. Failed motor results remain failed.

[Production-body motion panels](assets/closed-loop/README.md) likewise resolve neither approach nor avoidance from walking or flying starts. Light changes individual trajectories, but their paired directional means do not establish a reliable player-controllable effect. A lighting puzzle needs additional behavioral evidence.

[Final published-metadata performance](assets/performance/published/summary.json) measures three paired 16-fly active workloads: median overhead is 0.78%, below the 10% gate. This is bounded native throughput, not browser pacing. The [integration record](assets/integration.json) distinguishes native, client, build and browser checks. The [real browser harness](../../../tests/browser/directional-vision.mjs) exercises a vision-enabled worker, exact native-record decoding and campaign pause/seek/rewind with zero underruns in its bounded run. It does not claim that the campaign already uses vision.

## Visual provenance

The user's [selected-panel layout reference](../selected-fly-layout/README.md) establishes the compact roster and graphs directly below the brain. The earlier [directional-sensing capture](../directional-vision/assets/browser/paused-rewind.png) supplies a full-frame comparison; its older roster and camera differ, so pixel distance is diagnostic only. Current [vision details](assets/browser/vision-details.png), [explanation](assets/browser/vision-explanation.png) and [rewound view](assets/browser/paused-rewind.png) preserve the accepted order. [Independent review](assets/browser/visual-review.md) found no new structural clipping or overlap, while retaining existing concerns about scrolling, dense traces and scientific naming. About remains unchanged.

The [final choices](choices.md) record the model and operational decisions a future change inherits.
