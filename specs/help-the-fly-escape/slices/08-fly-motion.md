# 08 — Playback-driven fly animation

Status: planned. Dependencies: 07.

## Contract and seam

Walking, flying, landing and eating are recognizable without animation changing simulation.

Recorded pose/mode/events → GLB clips sampled by playback cursor.

## Runnable review surface

Asset lab clip viewer plus deterministic still-frame sequence and short playback recording.

## Verification

Pause freezes animation; replay/seek reproduce pose and clip phase; loops do not accumulate root motion. Transition frames remain attached to the body at all zooms. Compare sequences to static accepted model for unwanted deformation.

Visual variable and crop: Motion/pose readability; same close-fly crop at fixed timestamps. Texture, palette, trail and house detail are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Clip curves, stylized wing cadence and blends; no claim of literal biological wing frequency.

Human feedback that changes this slice: Animation rhythm can change independently of mechanics.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/08/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
