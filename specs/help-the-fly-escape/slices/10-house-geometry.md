# 10 — A readable 3D house

Status: modular kit integrated; solid-prop contract and fixture pass native/browser/source/fresh visual checks; merged-view and human acceptance pending. Dependencies: 07.

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

Selected-fly visibility also applies in Overview: Overview releases camera follow, not selection. When the selected fly's projected center is inside the drawable viewport, reduce intervening wall segments to their low bases in any camera mode. Offscreen selections and unobstructed views restore full-height walls. Verify the actual corner Overview, an unobstructed same-position Overview before/after, and offscreen pan; do not replace the occluded-corner case with an easier pose.

## Solid footprint checkpoint

Extend Geometry with a required `solids` array of `SolidProp { id, min, max, height }`. Each prop has a finite positive axis-aligned floor rectangle, a positive presentation height, and a unique ID. It must fit one room, clear wall segments, and not overlap another solid. Collision remains planar: the entire footprint blocks all body modes, regardless of presentation height. The same rectangle blocks line of sight and field transport, excludes field cells and tool placement, and positions/scales one neutral authored solid mesh. No separate renderer obstacle map or visual-only prop is allowed. Empty fixtures supply `solids: []`; no compatibility default is needed.

Add one solid to the shared five-room review fixture and expose a bounded core-owned diagnostic crossing around it through WASM. The workbench displays the core's stopped pose and line-of-sight result, never computes collision in TypeScript. Native tests pin swept contact, blocked visibility/field cells, open detour, invalid spawn/placement and unchanged doorway connectivity. Browser proof pairs the diagnostic stopped pose with the real GLB bounds and local solid replacement/disposal. Keep palette, lighting and campaign tuning outside this checkpoint.

Solid meshes follow the existing selected-visibility rule: an occluding solid keeps a low base of at most the wall-base height, using its original footprint, while the core collider and sensory occlusion remain unchanged. This prevents a tall prop from hiding the diagnostic contact pose, without turning it into an invisible obstacle. Unobstructed props restore their authored height. Include full-height Overview and a close stopped-body view; neither alone proves both collision and silhouette.

[Solid checkpoint evidence](../assets/evidence/10/solid/review.md) records the authored collider match, diagnostic browser paths, replacement proof and remaining acceptance gates.

## Production authored-asset gate

The earlier workbench proved the authored kit, but production setup and playback still instantiated primitive templates. This missing consumer gate is now explicit: both production views must load the same wall/floor/solid GLBs through the existing validated loader and replace the temporary templates through the same ownership seam. Preserve Geometry topology, palette, camera and lighting. Loading and failures must be visible; a stale asynchronous reply must dispose its assets rather than attach to a retired view. Verify real production network loads, bounded replacement/disposal, failure and retry, then compare identical setup/follow/overview captures.
