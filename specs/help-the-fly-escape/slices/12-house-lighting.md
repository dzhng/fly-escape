# 12 — Depth and exit lighting

Status: shadow artifact experiment active; acceptance pending 11 integration. Dependencies: 11.

First experiment freezes the accepted cool palette, meshes, camera and light positions/intensities. Compare depth bias 0, -0.0001 and -0.001 to reduce diagonal self-shadow banding on wall faces, without lifting contact shadows. The smaller adjustment leaves visible stripes; -0.001 passes the narrow comparison and hardware frame profile in [the evidence](../assets/evidence/12/review.md). Keep the existing normal bias and shadow-map size fixed. This bounded experiment precedes any exit emphasis adjustment; food-contact composition follows the 14 authored food integration.

## Contract and seam

Lighting makes the 3D room readable while the exit remains a clear focal point.

Renderer light/shadow setup → fixed material/geometry fixtures.

## Runnable review surface

Same overview/default/follow scenes plus fly near wall and food contact crops.

## Verification

Compare against approved material baseline for depth and shadow readability; inspect no crushing dark regions, washed-out yellow ring or wall/camera obstruction. Profile shadows with 20 flies.

Visual variable and crop: Lighting/depth cues; full frame and fly-ground/exit crops. Geometry, palette, camera and animation remain frozen.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Light positions/intensities, shadow resolution and ambient fill within performance targets.

Human feedback that changes this slice: Mood changes can alter lighting; do not use this slice to remodel the house.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/12/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
