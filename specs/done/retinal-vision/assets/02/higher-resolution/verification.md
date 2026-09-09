# Higher-resolution acquisition

The selected acquisition is a 128×128 linear-RGB camera raster pooled into 721 RGB8 cells per eye at 10 Hz. An independent reviewer inspected all 80 camera/compound images, both montages and sixteen enlarged comparisons. The doorway boundaries remain separate at floor and flight heights, furniture separates from floor, and lateral red/blue plus upper green targets remain distinct. Compared with 256×256 at the same cell count, the selected profile loses fine contour smoothness rather than the required major structure. The 217-cell profile merges small features; 469 cells are usable but offer less margin. The 64-pixel camera shows more staircase edges and unstable small features. See [all compound views](quality-montage.png), [camera views](camera-montage.png) and [pair metrics](comparison/visual-parity-diff.json).

The camera framing, full asset-derived eye rig, scene, poses and display encoding are fixed across candidates. The comparison enlarges the 128-pixel image with nearest-neighbor sampling to the reference's 256-pixel size; it does not fabricate detail. Texture moiré in the authored wall and smeared floor grain remain visible in raw cameras. Peripheral red/green features outside the compound aperture remain clipped at every tested resolution. Neither limitation is hidden by selecting a different crop. No claim is made about resolving shelf plants or fine texture.

The blue backing target sits beyond the authored doorway, not on its wall. Filling the actual aperture with an opaque blocker reduces target-blue cells from 68 to zero at floor height and from 82 to zero in flight in the selected profile. Pose return reproduces exact sample bytes, changed heading changes them, and GPU pooling agrees with an independent Float64 CPU oracle within one RGB8 level. GPU Float32 arithmetic defines the consumed bytes; the CPU oracle is a diagnostic comparison, not a second runtime backend.

## Hardware and bounded work

`RETINA_EVIDENCE_DIR=/tmp/fly-retina-full-moving bun run probe:retina-capture` ran Chrome 153 on an Apple M5 Pro via ANGLE Metal, with the real player view rendering concurrently. Each profile had 200 sixteen-fly batches with varying heading, height and position; the first twenty were warmup. [Raw results](benchmark.json) retain every run and sample fixture. Fixed physical objects and textured room assets load in the worker before acquisition. Measurements precede the shared daylight extraction in slice 03, which must recheck the final physical scene.

| Raster / cells per eye | p50 / p95 / worst complete batch, ms |
| --- | --- |
| 64 / 721 | 7.8 / 11.5 / 19.1 |
| **128 / 721** | **8.1 / 12.6 / 17.4** |
| 256 / 721 | 8.7 / 16.6 / 19.1 |
| 128 / 217 | 8.2 / 11.8 / 17.6 |
| 128 / 469 | 8.3 / 12.3 / 16.9 |

Selected-profile p95 submission is 3.2 ms, fence/readback 9.1 ms, unpack 0.1 ms and copy into a WASM-sized array 0.1 ms. Timers overlap submission components, so these quantiles must not be summed. Worker world initialization was 149 ms; the first capture, including shader compilation, was 162 ms. Loading must complete before a gameplay tick is prepared. These figures are acquisition evidence, not a complete neural-campaign performance claim.

The RGBA32F atlas is 8,388,608 bytes and its depth buffer is approximately 2 MiB; pooled RGBA8 output, CPU staging and the ordinary readback buffer are each 92,288 bytes. A full RGB batch is 69,216 bytes. Diagnostic full-camera readback allocates a separate 8 MiB CPU array and grows the reusable GPU readback buffer to 8 MiB. The raw benchmark includes that explicitly labeled diagnostic allocation; normal retry measurements show the smaller buffer. Other GPU memory consists of shared-authoring scene geometry/textures and shadows; driver allocation is not inferred from Three's resource count.

One batch may be pending. Overlap and more than sixteen flies are rejected. [Fault/retry evidence](failures.json) verifies cancellation, actual context loss, a never-signaling fence, a failed final GPU copy, ten recreate/dispose cycles with stable resource counts, and main-thread timeout/restart after a stalled worker. The worker deadline is 4.9 seconds; a main-thread 5-second watchdog also catches worker event-loop stalls. Initialization has a separate 30-second watchdog. Failures never substitute black or previous-frame samples.

## Complete replay arithmetic

The user clarified that the earlier 128 MiB cap was an agent assumption and delegated practical budgets. The current engineering target is 512 MiB. Sixteen flies × 6000 ticks × two eyes × 721 cells × three bytes is 415,296,000 bytes (396.06 MiB). Using the retained native fields, full pre-neural pose, maximum event slots, group activity, offsets and conservative one-tick envelopes, the fixed archive estimate is 466.43 MiB. Two motion points per fly-tick yield 481.08 MiB; three yield 488.40 MiB; four yield 495.73 MiB. The cap accommodates an average of approximately 6.22 motion points per fly-tick under that conservative model.

This is not an unconditional guarantee for every legal trajectory: the existing 129-point motion maximum would exceed the cap. Preserve explicit admission and cumulative overflow handling, then measure both complete campaign rounds in slices 07/11. No compression dependency, loss of color, rate reduction, history eviction or motion approximation was introduced to satisfy the estimate. The [earlier accounting audit](../archive-budget.md) explains every retained stream and the existing bounded-overflow policy.

## Review

Shape review retained four small production owners: projection/display, GPU pooling, acquisition/lifecycle, and static batching. The diagnostic UI/worker/fixture are separate from gameplay and use the shared world factory. Static batching owns only merged geometry; it restores original visibility and leaves source materials with their owners. A behavioral regression exposed mesh parents hiding unmerged children; only leaf meshes are now eligible.

Independent Codex review found a missing error check after the final GPU copy and an unbounded workbench worker request. Both were fixed and exercised with actual browser faults and explicit retry. A focused independent follow-up found no remaining concrete bugs; its browser environment was unavailable, so the root hardware fault results provide that verification. Seven focused projection/rig/batching tests and typecheck pass. The fresh visual review accepts the selected profile for major boundaries and records the peripheral/texture limitations above. The human review set was opened in one Preview window while independent native work continued.
