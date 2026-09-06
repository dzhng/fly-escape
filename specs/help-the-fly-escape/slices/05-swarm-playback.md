# 05 — Twenty flies with buffered replay

Status: native Attempt and packed record format implemented; Worker/archive/playback integration in progress. Dependencies: 04.

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

## Decision budget

Delegated: Chunk size and safety discount within cancellation/backpressure bounds; internal sparse optimization only with fidelity tests. If >30-second startup persists, split a measured optimization slice before campaign work.

Human feedback that changes this slice: Acceptable initial wait can be revisited with actual measurements; never reduce the fixed 20 flies or use terminal no-op ticks as throughput.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/05/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
