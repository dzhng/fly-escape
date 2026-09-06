# 04 — Finite life and physical escape

Status: native core/probes implemented; lifecycle browser integration pending. Dependencies: 03.

## Contract and seam

Eating extends a finite reserve; only crossing the exit scores.

sim body transition and outcome reducer → timestamped events/result; /lab/lifecycle.

## Runnable review surface

Short deterministic probes of feeding, starvation after a meal, landing, blocked exit and successful exit crossing.

## Verification

Silenced proboscis neurons plus food contact never start feeding. A feeding fly replenishes within cap, loses reserve later and can starve again. Loss of contact stops replenishment. A meal plus timeout scores zero; swept outward exit crossing counts once; adjacent wall crossing cannot escape. Use fixtures for semantics and actual graph runs for neural feasibility.

Visual variable and crop: State/time legibility; crop event strip and reserve display. Fly animation and final HUD layout are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Reserve capacity/costs, bout duration and motor thresholds, documented with the ablation evidence. No contact-only shortcut or starvation exemption.

Human feedback that changes this slice: If flies cannot initiate feeding through the graph, resolve the pathway/mapping before claiming food works.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/04/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
