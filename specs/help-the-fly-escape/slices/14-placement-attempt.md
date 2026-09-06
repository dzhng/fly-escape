# 14 — Editable setup and attempt loop

Status: planned. Dependencies: 05,06,10,13.

## Contract and seam

Players can place a fixed inventory, run, inspect results and retry with their setup intact.

web attempt state machine + sim placement validation/AttemptSpec → Worker; result → local progress store.

## Preparation passes

The accepted diagnostic fixtures select one sensory pathway for an entire attempt. That cannot represent simultaneous fruit, repellent and light tools. Before placement integration, prepare these independently verifiable core passes; final slice acceptance retains the dependencies above.

1. Separate attractive and repellent odor concentrations in the existing wall-aware solver. Both reuse its transport and geometry; neither becomes a direct steering vector. Export and record both antenna samples. Preserve the single-cue probe results and update the archive bound for the extra recorded values.
2. Allow simultaneous sensory currents from the relevant odor and vision pathways. Map each odor channel using measured circuit responses, not the biological words “excitatory” and “inhibitory.” Verify each source alone, mixed sources, per-channel ablation and deterministic replay. This source-to-input mapping is an explicit modeling assumption in the science panel.
3. Resolve tool placements into these core sources and physical contact/wind regions, then build the setup UI against the validated placement seam. Food replenishment remains separate from food odor, so feeding ablation can preserve the cue.

Changes to packed samples must regenerate the single Rust-owned layout and its TypeScript consumers together; no compatibility format survives in this unshipped app. Re-run the affected memory/performance gates before accepting mixed-tool attempts. Do this preparation in isolation from the sustained slice 05 benchmark so its build identity remains interpretable.

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
