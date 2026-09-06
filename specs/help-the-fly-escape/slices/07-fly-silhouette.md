# 07 — Blender fly and replacement workbench

Status: authored scale, close silhouette and replacement checks verified; dependency/human acceptance open ([review](../assets/evidence/07/scale-review.md)). Dependencies: 06.

## Contract and seam

A true 3D fly remains recognizable at close zoom and can be replaced without application changes.

Blender source → GLB contract → game-renderer asset loader → apps/asset-lab.

## Scale correction

The first authored model spans about 1.24 world units while the diagnostic fly bodies are only 0.4 units apart and use a 0.1-unit collision radius. Correct the authored asset to one-quarter of its current linear size (about 0.31 units maximum span), so the visible body fits its physical footprint and neighboring default spawns remain distinguishable. This is a source-asset correction applied everywhere, not a per-fixture renderer scale or changed simulation spacing. Bounds-derived follow distance must preserve the requested screen detail. Keep ground contact at zero and recheck clips, replacement bounds and selected-ring separation.

## Runnable review surface

Use Blender MCP to model/export; workbench accepts a local GLB replacement and shows validation errors, orientation and three zoom distances.

## Verification

Reproduce Blender glTF export/import round-trip first. Check +Y/+Z convention, pivot, scale, asymmetric orientation and disposal after repeated replacements. Compare close model to mock intent, not SVG pixel matching. Save .blend, GLB and fixture capture evidence. Final acceptance requires model, not indefinitely retained placeholder.

Visual variable and crop: Fly silhouette; neutral material, tight close/follow fly crops. Surface colors, lighting, animation and room art are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Modeling topology and detail within initial geometry/material budgets; retain legible anatomy rather than biological photorealism.

Human feedback that changes this slice: Body proportions or approachability can change before animation; missing Blender access allows independent work but does not complete art.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/07/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
