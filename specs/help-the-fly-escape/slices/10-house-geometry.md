# 10 — A readable 3D house

Status: modular kit and shared topology fixture prepared; renderer integration open. Dependencies: 07.

## Contract and seam

Room walls, doorways, dead ends and solid props are real meshes driven by authoritative geometry.

LevelDef geometry export + Blender modular kit → renderer; asset lab room fixture.

## Runnable review surface

Five-room greybox with one-door pantry, door-height fly crossing and local prop replacement.

## Verification

Render and collision openings agree by consumer fixture. Inspect dead-end wall continuity, pivots, scale and cutaway around followed fly. Test room reachability separately from neural success. Compare topology to authored diagram; verify repeated asset replacement frees resources.

Visual variable and crop: Room/door silhouette; neutral-material whole layout and doorway crops. Palette, textures, lighting and puzzle balance are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Wall thickness, furniture silhouette and modular breakdown; decor cannot introduce unmodeled obstacles.

Human feedback that changes this slice: Door or room readability can alter dimensions before level tuning.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/10/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.

## Prepared assets and topology

The [modular kit](../assets/evidence/10/kit.md) and [five-room collision fixture](../assets/evidence/10/topology.md) are prepared. The renderer must consume that same geometry payload; do not copy a second doorway/layout map into TypeScript. This fixture establishes room connectivity, not campaign balance.
