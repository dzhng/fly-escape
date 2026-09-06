# 09 — Readable white trails

Status: bounded packed-history and renderer preparation in progress. Dependencies: 08.

## Contract and seam

All small flies can be followed through recent recorded paths.

Playback pose history → renderer trail geometry, with bounded age/length.

## Runnable review surface

Overview and close fixtures with 20 flies crossing and a seek/replay sequence.

## Verification

Trails are white, fade with age, clear/rebuild correctly after seek and do not connect across discontinuities. Compare before/after for path visibility and obstruction; measure affected screen coverage in the busy crop. No trail continues advancing while paused.

Visual variable and crop: Trail visibility; mask recent paths in a busy crossing and selected close crop. Camera, model and room palette stay fixed.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Fade curve and maximum duration/width, tuned at overview and close zoom.

Human feedback that changes this slice: Crowding or obscured bodies changes trail width/lifetime, not simulation paths.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/09/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.

## Bounded history contract

The archive exposes only recorded pose/mode/outcome history for at most 40 ticks per fly, directly from packed fields; it does not decode or retain neural history for trails. The consumer caches this window until the integer playback tick changes. The first ten ticks are presentation-transition context; at most the most recent thirty ticks (three seconds) are visible, clipped further to two world units. The renderer uses the same presentation-height function as the fly. A mismatch between a tick's recorded input position and the prior resulting position breaks the path; an attempt replacement owns a fresh trail. Terminal samples stop adding new segments while their existing path fades with playback time.

One reusable mesh stores white, alpha-fading horizontal ribbons, depth-tested with no depth writes or shadows. Initial width is 0.025 world units and will be judged in both close and overview frames. Pause and seek reconstruct from the playback cursor, never wall time. The fractional endpoint is the already interpolated displayed fly pose; it cannot read a future trail sample. At most 30 segments per fly are uploaded, with fixed buffer capacity for the current population. These bounded presentation choices are provisional until the visual gate.

The first fixed-world-width candidate failed visual review: overly broad close trails painted over bodies, while Overview trails were nearly invisible. The revised candidate derives a 1.5 CSS-pixel width through the existing camera projector, bounded to 0.001–0.08 world units, and leaves one bounds-derived selection-ring radius of path behind the fly empty. Linear alpha fading preserves white visibility longer. Recompute projected width when the camera changes even during paused playback. This changes only trail visibility; the recorded path and age remain authoritative. Re-run the same close/Overview proof before acceptance.
