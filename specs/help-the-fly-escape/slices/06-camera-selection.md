# 06 — Close framing and shared selection

Status: functional preparation and grounded overview marker verified ([marker review](../assets/evidence/06/marker-review.md)); airborne association and dependency acceptance remain open. Dependencies: 05.

## Contract and seam

Model/card selection enters close follow; zoom preserves follow and only the yellow world ring marks pointer selection.

One web selectedFlyId → renderer camera controller and card scroll action.

## Marker readability decision

Keep the yellow depth-tested ground ring and its bounds-derived outer footprint. Preserve the existing 6% radial stroke at close range; at smaller projected sizes thicken inward toward 1.5 CSS pixels, capped at 45% of the radius to retain a central hole. Derive thickness from the live world-camera projection around the ring, so viewport, zoom and ground foreshortening govern readability without changing camera or physical/model scale. Reuse the ring geometry; no per-frame GPU resource allocation, outline, badge, arrow or fixture-specific correction.

## Runnable review surface

/lab/playback camera fixtures at overview, default, follow, extra-close, door crossing and terminal pose.

## Verification

Browser tests select through each surface, scroll a low card fully into view, zoom while moving and release follow with pan/Overview. Pointer selection has no black/blue focus outline; Tab focus remains visible on cards. Verify fly centres in drawable area excluding HUD, zoom bounds and wall cutaway visibility. Compare to approved framing and negative selection reference.

Visual variable and crop: Framing/selection visibility; full drawable world plus tight selected-fly crop at user screenshot framing. Asset quality, trails and palette are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Easing and precise angle within CONTRACTS.md; input bindings use wheel, drag, WASD/edge pan and Overview, with panel input excluded.

Human feedback that changes this slice: User may change close distance or pan-release behavior; do not reintroduce camera rotation.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/06/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
