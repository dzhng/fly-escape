# 10 — A readable 3D house

Status: complete. Dependencies: 07.

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

## Bounded renderer checkpoint

[Workbench evidence](../assets/evidence/10/renderer.md) covers topology-driven modular placement, doorway diagnostic poses, recursive cutaway, local part replacement and disposal. The ordinary fly workbench remains the default route. The loaded asset must preserve the kit bounds/pivot; replacement never changes collision data.

The solid-prop requirement was separated into the contract checkpoint below: add core-owned prop footprints and export them through Geometry, pin swept collision and sensory visibility against a consumer fixture, then map authored meshes to those footprints and review local prop replacement. Do not add decorative obstacles before that seam exists. This pass leaves Rust/WASM unchanged while slice 05 measurement runs; it does not complete slice 10 or authorize palette, lighting, or campaign work.

## Enclosure cue checkpoint

Fresh review found that removing both walls at a followed corner turns the room into a bare slab. Preserve a low base of each occluding wall by reducing that segment owner's presentation height. Restore full height before the next visibility query and whenever follow ends. The base uses the existing authored mesh and authoritative segment transform, introduces no second boundary map, and changes no collision geometry. It must remain below the fly body while keeping the corner readable. Compare identical corner-follow and overview poses before/after; pin recursive owner reduction and full-height restoration in renderer tests. Close-up wall-shadow banding remains a lighting acceptance item.

The low-base review also exposed a notch where perpendicular wall segments end on the same point. Extend only those shared, noncollinear visual ends by half the kit thickness so the outside corner is filled. Lone ends, including door jambs, retain their exact segment extent. Derive joins from the supplied wall endpoints; keep the simulation topology unchanged. Pin corner coverage and unchanged opening clearance, then inspect identical corner and overview states with the current selection-ring code.

The user’s [Sims-inspired wall update](../assets/evidence/24/sims-walls/README.md) supersedes selection-only wall cutaway. Full-height back walls remain; foreground walls retain a short solid base and a faint upper section whether or not a fly is selected. Verify room visibility through setup, follow and RTS panning.
