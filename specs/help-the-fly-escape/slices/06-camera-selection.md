# 06 — Close framing and shared selection

Status: planned. Dependencies: 05.

## Contract and seam

Model/card selection enters close follow; zoom preserves follow and only the yellow world ring marks pointer selection.

One web selectedFlyId → renderer camera controller and card scroll action.

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
