# 18 — A natural, reproducible starting swarm

Status: implementation active. Dependency: 05 and 14. Required before final 15/16 calibration.

## Contract and seam

Twenty flies begin in one authored area, at different legal positions and headings, with both walking and flying represented. After initialization, existing neural/body dynamics own movement. Random initialization must not consume neural-noise RNG state or become ongoing random steering.

Rust owns `SpawnDef`: `Fixed { states }` for explicitly controlled scientific fixtures, or `Cluster { min, max, flyingCount }` for campaign content. Fixed states contain pose and initial Walking/Flying mode. Cluster states use a dedicated seed domain, full-circle headings, bounded rejection sampling (128 candidates per fly), and a seeded shuffle assigning exactly the authored flying count. Reject invalid content or exhausted sampling explicitly. Check walls, solids, hazards and overlapping initial bodies. Placement excludes the entire cluster area, expanded for body/tool clearance; it cannot reserve only sampled points.

`AttemptInfo.initialBodies` exports the actual constructed `BodyState[]`. Initial rendering, camera, cards and archive tick zero consume those states. The UI never samples a second swarm. Replace the old fixed-pose field and migrate active callers; preserve archived experimental input bytes as historical evidence, not compatibility support.

## Runnable review surface and verification

Use a production setup/attempt fixture with twenty flies. Same seed reproduces every initial body; several different seeds vary positions, headings and mode assignment while remaining within the same area. Check both modes, spacing, walls/props/hazards, bounded failure, placement exclusion and neural RNG independence. Assert tick-zero metadata agrees with the first rendered/replayed state and seek-to-zero restores it. Existing controlled scientific fixtures retain their intended initial states and neural equations.

Visual variable: starting arrangement and mode only. Compare fixed default/follow crops at tick zero and early playback; furniture, materials and light stay frozen. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md), then an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the last visual check. Open the shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); the five-minute human checkpoint is non-blocking while independent work continues.

## Decision budget

Delegated: internal naming, legal authored cluster dimensions and a balanced initial 10 walking / 10 flying split for the first candidate. The ratio is a planner choice, not a user-specified number. Do not guarantee an escape-facing heading or inject warmed brain state. New starts invalidate prior campaign difficulty acceptance. Bank evidence under `assets/evidence/18/` and update the global handoff.
