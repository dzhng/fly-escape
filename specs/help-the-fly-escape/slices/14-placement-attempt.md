# 14 — Editable setup and attempt loop

Status: planned. Dependencies: 05,06,10,13.

## Contract and seam

Players can place a fixed inventory, run, inspect results and retry with their setup intact.

web attempt state machine + sim placement validation/AttemptSpec → Worker; result → local progress store.

## Runnable review surface

A five-room integration fixture with palette, valid/invalid placement, fan rotation, Run, cancel, result, replay and Retry.

## Verification

Place/move/remove consumes/refunds correctly. Core rejects invalid geometry without consuming items. Run freezes setup; retry edits old placements but next Run has fresh seed. Replay does not create another result. Reload retains best stars/preferences/setup; unfinished attempt ends. Storage failure leaves session playable.

Visual variable and crop: Placement feedback clarity; toolbar, placement ghost and error/result crops. Final level difficulty and decorative art are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Control spacing/icons and error wording; retain no shop, no tutorial modal, no mid-run edits.

Human feedback that changes this slice: Placement friction can change reversible controls; scoring/seed semantics remain fixed.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/14/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
