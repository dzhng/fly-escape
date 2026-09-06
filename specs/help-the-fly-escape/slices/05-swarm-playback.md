# 05 — Twenty flies with buffered replay

Status: complete; functional, visual and dependency gates verified. Dependencies: 04.

## Contract and seam

A complete 20-fly attempt plays smoothly from bounded compact records.

AttemptSpec/FrameChunk/Worker credits → archive and one playback cursor; /lab/playback.

## Runnable review surface

20 placeholders, aggregate counters, per-fly sample readout, pause/1×/2×/seek/replay and visible buffering; downloadable performance report.

## Verification

Use real graph and full-duration active work. Exercise stale messages, cancel/restart, pause, seek, memory growth, hidden-tab resume and depleted buffer. Pose and telemetry timestamps agree; replay matches its original record. Bound in-flight chunks/archive and release old attempts. Ten full 1× runs must avoid repeated underruns. Report wait, throughput, frame/input latency and memory against CONTRACTS.md. Probe 100 for scaling only.

Visual variable and crop: Playback-state legibility; crop timeline and selected readout. Detailed panel, real assets and final camera are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

Transport checkpoint: [browser evidence](../assets/evidence/05/browser-transport.json) covers hidden credit draining, cancellation during load/run, exact repeated-seed records, exclusive buffer ownership and callback-triggered restart. The generation regression was observed failing with the filter removed. WASM session tests preserve one-tick backpressure and terminal records. These checks do not substitute for production rendering or ten full playback runs.

[UI review](../assets/evidence/05/ui-review.md) records the production browser controls, real visual changes, independent reviews and measurement limits.

## Memory and capacity evidence

The [memory probe](../assets/evidence/05/browser-memory.json) measures live main/Worker heaps and adds the full-run WASM high water, complete archive allowance, raw graph allowance and renderer-owned GPU estimate. Its conservative total is about 231 MiB on Chrome 152 / Apple M5 Pro, below the 512 MiB owned-memory target. Some backing stores may be counted twice; browser process, compositor and driver overhead are excluded. This is an application-owned estimate, not process RSS. GPU traversal runs only when downloading a report, so continuous timing does not pay its cost.

The [100-fly probe](../assets/evidence/05/browser-capacity.json) completed 100,000 active neural steps at about 0.495× real time. A full 100-fly horizon is rejected before allocating brains because its bounded record requires about 349 MiB against the 128 MiB archive cap. This proves bounded capacity behavior, not a supported 100-fly game configuration; future scaling needs both compute optimization and a revised record policy.

## Decision budget

Delegated: Chunk size and safety discount within cancellation/backpressure bounds; internal sparse optimization only with fidelity tests. If >30-second startup persists, split a measured optimization slice before campaign work.

Human feedback that changes this slice: Acceptable initial wait can be revisited with actual measurements; never reduce the fixed 20 flies or use terminal no-op ticks as throughput.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/05/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.

[Sustained browser evidence](../assets/evidence/05/full-playback/review.md) completes the ten-run baseline gate. Later simulation builds retain their own affected integration/performance checks.
