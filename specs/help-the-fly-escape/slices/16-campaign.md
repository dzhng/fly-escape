# 16 — Four more authored puzzles

Status: implementation pending Level 1 acceptance; additional content and campaign progression are not implemented. Dependencies: 15.

## Contract and seam

Five sequentially unlocked levels grow in rooms and decisions; food sustains larger-map routes.

Four additional LevelDefs using existing tool/geometry schema → campaign progression.

## Implementation pickup

After 15 passes, author one level at a time in the same authoritative content seam. Add a campaign selector and derive one-star unlocks from persisted best stars; the existing progress store already holds per-level stars and editable setups, so it remains the persistence owner. The current browser still starts the integration fixture and has no campaign navigation or unlock consumer. Do not create a second progress store or duplicate level geometry in TypeScript.

The [game contract](../GAMEPLAY.md) owns increasing room counts, tool eligibility, topology and food-dependence requirements.

## Runnable review surface

Each level individually playable with topology and reference solution; campaign selector with earned stars.

## Verification

Accept levels 2, 3, 4 and 5 separately using GAMEPLAY.md paired/holdout criteria before moving to the next. Verify increasing room counts and one-star unlocks. For 4/5 perform food-replenishment ablation holding odor constant. Check no required route is sealed and zapper cannot cover spawn/only exit. Run a fresh-progress complete campaign.

Visual variable and crop: Topology readability per level; overview and critical junction crops, with accepted house materials frozen. New visual effects and tool types are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Authored topology, names, inventory, timing and thresholds within GAMEPLAY.md; no procedural generator or new mechanics hidden in content work.

Human feedback that changes this slice: Human difficulty feedback may reshape a level; failed cue evidence sends work to slice 03.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/16/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.

## Prepared six-room greybox

Prepare Turn the Corner with main route 1→2→3→4→6 and a straight-ahead, one-door dead end 5 at the fork in room 3. Inherit the frozen Level 1 body/tuning, spawn and duration; add one existing fan for the required bend. Reference and poor use the same legal placements with different junction/upper-route fan headings. Validate actual Geometry sweeps and wall-aware fan crossing, then inspect overview and junction through the existing renderer. Candidate and evidence stay under `assets/evidence/16/prepared/`; no neural calibration or acceptance batch before 15 acceptance.
