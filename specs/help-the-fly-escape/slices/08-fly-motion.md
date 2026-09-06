# 08 — Playback-driven fly animation

Status: functional integration verified; authored motion readability is being refined. Dependencies: 07.

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

## Prepared implementation (2026-09-07)

Absolute clip sampling and the clip workbench are implemented; [motion evidence](../assets/evidence/08/motion-review.md) owns the checks and remaining review gates. Acceptance remains dependent on 05/06/07 and a final fresh visual critique.

The packed archive owns a fixed-size transition cache: current mode, prior mode, latest mode-change tick and first terminal tick. Recorded resulting body state is authoritative; mode-change/feeding/terminal events already describe that same change and are not replayed as a second mutable animation state machine. Ordinary playback scans newly crossed ticks; reverse seeks rebuild directly from at most 6000 packed ticks. Retained scratch is 8 bytes per fly, within the existing metadata allowance. No wire format, neural cadence, physics or build identity changes.

Walking and flying loop their authored clips; feeding takes precedence on a recorded feeding mode. A flying-to-walking transition shows the authored 0.8-second landing clip before walking resumes. Terminal outcomes freeze clip time at the first terminal tick. Presentation changes no root position or collision height. No animation crossfade state or independent renderer clock is retained.

The [integration review](../assets/evidence/08/integration-review.md) records passing current-asset timing tests and rejected pose clarity. Strengthen walking/feeding recognition and inspect a complete motion sequence before acceptance.
