# 14 — Editable setup and attempt loop

Status: core preparation implemented in isolation; setup UI planned. Dependencies: 05,06,10,13.

## Contract and seam

Players can place a fixed inventory, run, inspect results and retry with their setup intact.

web attempt state machine + sim placement validation/AttemptSpec → Worker; result → local progress store.

## Preparation passes

The accepted diagnostic fixtures select one sensory pathway for an entire attempt. That cannot represent simultaneous fruit, repellent and light tools. Before placement integration, prepare these independently verifiable core passes; final slice acceptance retains the dependencies above.

1. Separate attractive and repellent odor concentrations in the existing wall-aware solver. Both reuse its transport and geometry; neither becomes a direct steering vector. Export and record both antenna samples. Preserve the single-cue probe results and update the archive bound for the extra recorded values.
2. Allow simultaneous sensory currents from the relevant odor and vision pathways. Map each odor channel using measured circuit responses, not the biological words “excitatory” and “inhibitory.” Verify each source alone, mixed sources, per-channel ablation and deterministic replay. This source-to-input mapping is an explicit modeling assumption in the science panel.
3. Prepare local fan wind: the diagnostic ambient vector cannot represent a placed directional tool. Add bounded wall-occluded fan footprints to the shared field grid; both odor face advection and body samples consume this owner. Use a conservative per-cell outgoing-flux bound for solver subdivision. Preserve ambient-wind probes. This stylized jet is not a fluid simulation.
4. Resolve tool placements into core sources, food contact regions and these local fans. Core edits validate the whole proposed setup before replacement and derive inventory from accepted placements, so invalid edits cannot spend an item. Export immutable resolved placements with attempt inputs. Food replenishment remains separate from food odor, so feeding ablation can preserve the cue. Then build setup UI against this validated seam.

Changes to packed samples must regenerate the single Rust-owned layout and its TypeScript consumers together; no compatibility format survives in this unshipped app. Re-run the affected memory/performance gates before accepting mixed-tool attempts. Do this preparation in isolation from the sustained slice 05 benchmark so its build identity remains interpretable.

Preparation passes 1–4 have core/API implementations in isolation, including local fans and placement resolution; see [mixed-sensory evidence](../assets/evidence/14/mixed-sensory.md) and [placement evidence](../assets/evidence/14/placement.md). Setup UI, campaign tuning and integrated release gates remain planned. Integration must rerun the affected browser memory/performance gates: a full 20-fly archive bound is now 80,104,384 bytes, still below 128 MiB. This does not close slice 14 or change its dependencies.

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

The functional setup/attempt pass and its evidence are documented in [setup review](../assets/evidence/14/setup/README.md). This closes the editor lifecycle seam; it does not claim campaign balance or decorative-art acceptance.

## Bounded Level 1 tool-art preparation

Fruit and scent crumbs need recognizable Blender-authored shapes in setup and recorded playback; the colored cylinders are diagnostic placement markers, not final tool art. This subpass owns only these two silhouettes, their replaceable GLBs/.blend sources and their placement/food-context verification. Fruit remains an edible, non-solid floor contact surface; crumbs retain odor-only semantics. Later vinegar, lamp, shade and fan shapes are separate future art subpasses, not implicit work in this checkpoint.

The authoritative catalog owns placement radius and food contact radius. Art is anchored to placement centre/heading and scaled from its footprint, without changing geometry, collision, neural movement, feeding heading, materials for rooms, or lighting. Near-flush relief at or below 0.005 world units preserves the existing ground-plane presentation rather than introducing a second surface-height simulation. Capture and document native asset bounds, the relief/foot-contact approximation and any boundary feeding mismatch: the core can register body-circle contact outside the visual footprint, which is not proof of mouth contact.

Verification is separate from functional editor acceptance: preserved separate Blender source scenes and GLB round-trip; finite static bounds and replacement/disposal checks; same-state setup/playback before/after; actual recorded feeding context where available; fresh visual critique for shape readability, floor contact and body clearance. This prepared pass does not close 14, dependency 10, campaign 15 or the later tool-art breadth.

Required presentation assets share setup readiness: house, food, and fly must all load before Run. Playback holds its presentation clock until that view's assets arrive, retaining requested pause/play intent. A failed required asset remains an explicit error; late results release resources when their view has retired. HTTP failure/delay tests run against the development asset transport because production bundling may inline small GLBs.
