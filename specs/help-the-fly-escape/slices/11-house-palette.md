# 11 — House materials and color

Status: prepared; integration and final review pending. Dependencies: 07,10.

[Prepared palette evidence](../assets/evidence/11/review.md) covers production and authored assets under frozen lights.

## Contract and seam

Cool home surfaces, readable flies and a warm orange exit establish the approved direction.

Material palette registry → existing renderer meshes; no geometry changes.

## Runnable review surface

Identical overview/default/follow fixtures under fixed neutral lighting.

## Verification

Use compare-screenshots with mock and previous greybox; measure color distribution/contrast in room, fly and exit masks. Labels remain readable without color alone. Keep texture detail restrained at close zoom.

Visual variable and crop: Surface color/material contrast; room-floor, fly-body and exit masks. Geometry, camera, animation and lighting are frozen.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Exact colors, roughness and subtle surface texture; no new geometry or lighting changes.

Human feedback that changes this slice: Color preference is reversible; record reference and selected palette.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/11/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
