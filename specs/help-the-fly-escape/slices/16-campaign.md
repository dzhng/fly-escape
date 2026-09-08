# 16 — A carefully designed second level

Status: both furnished houses and campaign progression are integrated. Second-level route tuning and timed-round calibration remain open; final acceptance depends on 15.

## Contract and seam

Two authored levels grow in rooms and decisions; the second adds meaningful object-placement decisions on its larger route.

One additional LevelDef using the shared tool/geometry schema → two-level campaign progression.

## Implementation pickup

The production registry and level files in `apps/web/src/` are authoritative. Earned first-level stars unlock the second level through the existing progress store; actual browser completion verifies that transition. Do not reintegrate the obsolete isolated campaign worktree.

The current second house starts in the study and traverses the hall and kitchen. Ordinary door openings and native furnishings are settled enough for bounded route/food diagnostics. Timed wall sliding fixes the measured doorway stall; tune placements on current geometry, then freeze and run the campaign criteria. Food remains a physical landing/walking distraction; feeding and starvation are deferred.

The [game contract](../GAMEPLAY.md) owns increasing room counts, tool eligibility, topology and food-dependence requirements.

## Runnable review surface

Each level individually playable with topology and reference solution; campaign selector with earned stars.

## Verification

Accept level 2 using GAMEPLAY.md paired/holdout criteria after the furnished geometry and randomized spawn contract are settled. Verify increasing room counts and one-star unlocks. Use the timed-round acceptance contract; food-replenishment ablation is deferred. Check no required route is sealed and zapper cannot cover spawn/only exit. Run a fresh-progress complete campaign.

Visual variable and crop: Topology readability per level; overview and critical junction crops, with accepted house materials frozen. New visual effects and tool types are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Authored topology, names, inventory, timing and thresholds within GAMEPLAY.md; no procedural generator or new mechanics hidden in content work.

Human feedback that changes this slice: Human difficulty feedback may reshape a level; failed cue evidence sends work to slice 03.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/16/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.

## Historical finite-energy validation preparation

The food-energy requirements below are historical preparation, superseded for MVP by the user’s timed-round decision. They are not active acceptance gates.

The existing campaign probe now prepares to validate 5–9-room authored Geometry rather than a hardcoded first-level adjacency list. Shared openings are tested through body occupancy and sweep, independent of room array order; all rooms and spawns must connect to an exit with a clear outward body sweep. This is offline topology validation, never runtime steering. Explicit no-fans controls preserve reference scents. A separate diagnostic food-energy arm sets only the existing feedingRate to zero, preserving source/food placement, contact and taste configuration; later energy-dependent behavior may diverge. Per-fly body events/reserves and paired starvation medians distinguish missing replenishment from navigation. Detector-only modes cannot report seed-set acceptance. A full frozen food-energy run retains its reference/poor placement gate and reports a separate food-energy gate requiring higher median escapes and lower median starvation than the no-replenishment arm, with paired medians retained as diagnostics. Full acceptance batches follow settled first-level contracts; bounded second-level diagnostics may proceed independently.

Preparation checks: six focused native tests pass, including real five-/six-room fixtures in both room orders and a red check against the retired hardcoded topology. Diagnostic, incomplete, unfrozen or missing required control summaries cannot pass the seed-set gate. Shared-boundary sampling remains bounded to 99 positions per edge, so it can conservatively reject an unusually narrow unsampled opening; it does not prove within-room navigation or puzzle benefit. Food-energy evidence does not by itself accept campaign content; the full reference/poor gate remains usable without repeating identical arms.

The user reduced scope to two well-designed levels and requested a randomized mixed walking/flying starting swarm. The existing six-room preparation is topology evidence only; its fixed, aligned spawn and inherited timing are superseded for campaign acceptance. Rework it with furnishings, randomized starts and food dependence before final seed evaluation.
## Content and progression preparation

The home route exposes the two prepared authored level inputs while balancing continues. The setup editor consumes those inputs and the core catalog; it never obtains production content from a diagnostic fixture. The diagnostic fixture remains at /lab/setup. The authored registry preserves topology and inventories, with current native physical dimensions and randomized mixed starts.

Campaign ownership holds best stars, per-level editable placements and preferences. Sequential unlocks derive from the contiguous prefix of levels with at least one best star. Switching level recreates the editor/worker and retains campaign progress; selection is unavailable during an attempt. Palette visibility follows original inventory, while exhausted kinds remain visible with zero stock. A test-only authored campaign verifies UI progression and storage without joining the release registry. Reset and unavailable persistence must preserve a usable in-memory session. Final balance, food dependence and furnished visual acceptance remain open for the two-level campaign.

The real-home browser smoke runs both authored inputs through setup, a mixed twenty-fly attempt, recorded playback and return to setup. Its one-star persistence fixture checks sequential unlock without claiming a successful calibrated puzzle run.
