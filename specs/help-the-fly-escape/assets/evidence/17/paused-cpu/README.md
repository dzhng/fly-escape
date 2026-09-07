# Paused production CPU audit

No high-impact optimization is justified by this short profile. The unchanged-cursor motion/trail/cutaway work exists, but its observed main-thread cost is small. Preserve visual/physics behavior and proceed with the separate full-attempt release gate.

## Input and identity

Actual first-house campaign at `http://127.0.0.1:5322/`, 20 real flies, normal release followed by Pause after tick 10. Chrome 152.0.7977.77, headless, viewport 1440×1000, DPR 1. The cursor stays 10.667 before/after profiling. There are 601 additional render-frame observations over a 10.06-second profile. This uses the default close follow of fly0; only that fly projects visibly in the recorded camera. It is not a whole-house worst-case profile. No browser errors.

`identity.json` records the full attempt seed, graph/manifest/build/level hashes, static bundle SHA, camera and frame delta. `report.json` preserves the surrounding playback reports. `capture.mjs` records the exact scratch launch and waits. The browser was closed after capture. No source/runtime edits or profiling flags changed application behavior.

## Measured dismissals

| Candidate / inclusive sample region | Samples | Estimated time over 10.06 seconds | Disposition |
|---|---:|---:|---|
| Pose preparation, including WASM sampling | 19 | 28.6 ms | Do not cache for release on this evidence |
| WASM sampleMotion (inside preceding row) | 17 | 25.6 ms | Bounded, ~0.25% wall time |
| Recorded trail conversion | 1 | 1.5 ms | Too small to prioritize |
| Trail geometry rebuild | 22 | 33.1 ms | ~0.33% wall time; no demonstrated bottleneck |
| setPoses / animation guard | 2 | 3.0 ms | Existing FlyMotion identical-input guard works |
| Furniture cutaway | 17 | 25.6 ms | No justified cache/invalidation complexity |
| World render, including trail/cutaway | 756 | 1130.0 ms | Context, not a defect claim |
| Three renderer, inside world render | 702 | 1049.4 ms | Context |
| Shadow renderer, inside Three renderer | 394 | 589.8 ms | Context; changing shadows would require fidelity proof |

The furniture roots contain 14,940 authored triangles across five first-house placements and 17,072 across six second-house placements. Raycasts have ordinary mesh bounds rejection; these totals are conservative candidate geometry, not measured triangle intersections. Repetition does not grow with attempt history.

Existing safeguards dismiss other amplification candidates: two frame credits, 128 MiB archive capacity, binary-search chunk lookup, 40-tick pose history, 30 trail segments per fly and 100-tick visible-card neural history. Animation sampling skips identical clip/time. Grass rebuilds only when cached bounded coverage changes. The prior Worker revival, retired-renderer texture listener and duplicate skeleton defects already have repairs/evidence; this audit found no new retention owner or unhealing retry loop.

## Limits and reproduction

`profile.cpuprofile` is a DevTools CPU sampling profile requested at 1000µs, with 6687 actual samples. Attribution uses inclusive call-tree regions from the exact recorded bundle: production `xm` (pose preparation), `Op` (recordedTrails), `cp` (cutaway), named sampleMotion/setPoses/render methods and the identified FlyTrails/FlyMotion sample locations. `attribution.json` records those totals. Nested rows overlap and must not be summed as independent costs. Sparse small regions have coarse uncertainty; this is one short observation, not a stable speed guarantee.

The profile covers the main renderer thread. It does not measure Worker CPU, GPU duration, process RSS, combined memory, whole-attempt endurance, responsiveness under interaction or other platforms. The report's p95/max frame statistics include pre-profile playback and startup; they are not isolated paused-window percentiles. Idle time dominates the sampled timeline. No claim follows from draw-call count alone.

Run the archived capture script with the repository's installed Playwright and the same static server available; it writes `/tmp/fly-paused-profile`. Rerunning without rebuilding preserves the same implementation, but a fresh random seed means a different pose. For exact input identity use the archived attempt spec rather than presenting a new seed as a matched comparison. No further profile was needed for this dismissal.
