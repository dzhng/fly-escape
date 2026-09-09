# 03 — Shared world construction and eye rig

**Depends on:** 02. **Question:** do the acquired eyes see the authored physical scene from the correct pre-neural transform?

## Contract and seam

Extract `WorldScene` construction from existing house, placement, room-detail and asset-loading consumers into `packages/game-renderer/src/world-scene.ts`. Both the sensory renderer and `WorldView` consume it; each owns separate mutable instances. Existing geometry, placement and emitter definitions remain authoritative. Remove `retinaFixtureScene` from slice 02 in this pass.

Locate two fixed eye origins on our real fly model and document their conversion into the native body frame. Use complete position/height/quaternion from `BodyState`, captured before stepping. Make the rig immutable and hash it with the profile. Do not copy FlyGym eye offsets in a different unit system. `WorldView` animation and player-adjusted scale have no effect on these origins.

Freeze a sensory scene manifest documenting visible mesh categories, fixed exposure, light/shadow treatment, shade-object appearance, near/far planes and the exclusions in contracts. Preserve actual window and furniture geometry rather than infinite-height collision proxies. Lights come from shared authoring, including authored fixture color. No knowledge of which opening scores an escape enters the sensor.

## Runnable artifact and verification

Extend `/retina` to choose fixed ground, tilted support and flight poses; overlay eye frusta only in the diagnostic third-person view. Add `bun run test:retina-optics` browser fixtures. Archive pre-neural transforms, scene/profile hashes and RGB sample hashes in `assets/03/`.

Move the player camera, change selected fly, resize the page and enable cutaways: frozen-pose sensor bytes must not change. Move a physical object or lamp through the resolved setup: both scene consumers must reflect the new authoring. Test above/below furniture, real doorway occlusion, wall adjacency without near-plane leakage, and quaternion orientation on a tilted support. Independently check transforms with asymmetric axis markers, not a symmetric fly silhouette.

**Visual variable/crop:** eye placement and physical visibility, crop eye interiors plus local rig/frustum detail. Decorative density, fly animation and panel styling are out of scope. Compare with the slice-02 accepted optical fixtures and unchanged game baselines; finish with unprimed screenshot-critique.

## Verdict and decision budget

Pass when shared authoring and eye-pose invariance hold through both consumers and all exclusions are explicit. Delegate measured rig attachment coordinates, fixed clipping distances sufficient for fixtures, and internal extraction shape. Changes to scene categories or photometric model beyond contracts require updating this slice and profile before continuing. Existing player rendering, setup and asset-loader tests must remain green.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status: preparatory rig and shared-world artifacts verified; slice not passed.** The [fixed-eye exporter and provenance](../assets/03/eye-rig.md) measure neutral skinned GLB eye centres in native metres and preserve source optical axes. Geometry, side-specific axis checks, immutability and the renderer test suite pass. Acquisition integration, mounted-rig visuals and the end-to-end physical-visibility/invariance gates above remain unimplemented. This independent asset measurement does not bypass the slice-02 acquisition gate.

**Shared-world preparation:** [Composition, construction policies and verification](../assets/03/shared-world.md) now provide independently owned physical/presentation worlds through shared authoring and loaders. Four production overview/orbit frames remain byte-identical. Physical geometry/resource tests pass; lighting resolution, sensory rendering, mounted-rig views and full slice acceptance remain parent integration work.

**Integrated verdict: passed.** See [physical scene contract](../assets/03/sensory-scene.md) and [acquisition, pose, review and fault evidence](../assets/03/verification.md). Earlier preparatory statuses above describe intermediate work. Gameplay rendezvous remains slice 06.
