# 02 — One real brain in the browser

Status: planned. Dependencies: 01.

## Contract and seam

The first useful browser checkpoint shows one graph-driven fly and measured neural values.

crates/sim LIF/readout → game-wasm bounded step → sim-client Worker → /lab/brain.

## Runnable review surface

A simple 3D chamber, asymmetric fly placeholder, seed/reset and one measured telemetry card; root dev/build/test commands.

## Verification

First reproduce the official wasm-bindgen Worker example in a bounded spike, then keep only the production seam. Match Python injected-noise fixtures, refractory/clamp behavior and motor readout. Run the actual exported graph, record load time, active ticks/s and memory. A synthetic fallback cannot pass. Confirm UI stays responsive while the Worker advances.

Visual variable and crop: Measured-data legibility; crop the telemetry card. Chamber art, final camera and fly beauty are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Internal allocation strategy, PRNG choice frozen in metadata, placeholder proportions; preserve f64 parity and 0.1-second game tick.

Human feedback that changes this slice: This checkpoint exposes whether the real graph can drive an observable fly before art or campaign effort.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/02/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.
