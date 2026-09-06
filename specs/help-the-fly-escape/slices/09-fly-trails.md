# 09 — Readable white trails

Status: planned. Dependencies: 08.

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
