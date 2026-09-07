# 22 — Natural authored materials

Status: in progress. Authored materials and the meadow are integrated; close surface realism and final visual/cost acceptance remain open. Dependencies: 21.

## Contract, seam and review surface

Preserve Blender-authored glTF PBR materials in production. Remove unconditional role-palette recoloring and its duplicate appearance ownership. Keep accepted shape, camera and lighting fixed. Bake procedural material inputs to portable texture channels when required; declare color versus data texture spaces correctly. Assets stay local with provenance and redistribution rights recorded; no runtime asset service.

Visual variable: surface appearance. Judge wood grain scale, painted plaster, fabric, leaf surfaces and fruit skin at close range, with room-level real colors. Verify authored color/roughness survive import, texture disposal and replacement, and record texture/material/draw-call cost. Primary references are in RESEARCH.md. Lighting improvements are deferred to 23.

## Exterior grass pass

Implement the [exterior coverage requirement](../GAMEPLAY.md#visual-target-a-warm-lived-in-house) as a separate focused visual pass within this slice, keeping the accepted house appearance and fixed camera angle. Use a finite circular grassy ground surface around the house, with instanced blades at uniform detail. Natural color, height and clump variation should suit a domestic lawn at this game's physical scale. Mask the actual house footprint so blades do not protrude through interior floors or walls.

Use `~/dev/game` as an implementation reference: its [production blade-field layer](../../../../game/packages/photoreal-renderer/src/battle/bladeFieldLayer.ts) uses instanced blades, distance-based detail tiers and GPU routing/culling; its [grass-field sampler](../../../../game/packages/game-renderer/src/battle/grassField.ts) supplies packed placement records. The [blade-field workbench](../../../../game/apps/renderer-lab/src/routes/bladeField.ts) demonstrates inspection and renderer statistics. Use its instancing and packed-data approach as the reference; do not carry over its distance-detail tiers or GPU routing machinery unless measurements here justify them. Adapt to this repository's Three.js renderer rather than importing the battle renderer or its terrain dimensions. Reference code is local research, not a runtime dependency or a mandate to change rendering backends.

Bound blade records, draw calls, update work and retained resources. Avoid an object or CPU animation loop per blade; generate stable placement data and use GPU deformation if grass movement is included. Start with one grass detail level; no distance-based detail or streaming system is required. Size the circular ground and set zoom/pan bounds together so its finite edge stays outside the view at the fixed camera angle, including supported aspect ratios and pan extremes. Maximum zoom-out must still show the whole house.

Verify actual browser captures at close exterior views, default framing, maximum zoom-out and pan limits. Inspect house/grass boundaries for clipping and confirm the circular cutoff stays offscreen without blank exterior ground, shimmer or bare bands. Record canvas-only before/after evidence and grass cost with twenty flies running; preserve existing frame/input/buffer budgets. Loading, repeated attempts and disposal must not accumulate grass resources. Final composed visibility and illumination remain with23–24.

## Standing verification and decision budget

Use the production renderer in the existing asset workbench, with a representative room, fixed cameras and recorded attempt. This is a diagnostic fixture, not a third campaign level. Preserve twenty real-connectome flies, neural ownership, deterministic replay and the current performance budgets. Blender renders are authoring evidence; actual browser captures determine acceptance.

For visual evidence, save full frames at default, close follow, further zoom and maximum wheel zoom-out plus the named crops. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the preceding pass/reference and run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the last visual acceptance check. Open shots through [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); the five-minute feedback window is non-blocking while independent work continues. Record the verdict and close shots.

Delegated: reversible asset composition, implementation naming and measurements needed to resolve this slice's question. Record new physical assumptions before dependent implementation; do not silently change neuron dynamics, world scale, contact semantics or fidelity target. Update the global handoff and bank focused evidence under this slice's number. Deferred variables must remain frozen until their owning slice.

## Integrated exterior

The camera bounds the circular lawn independently of house geometry. Normal maximum zoom uses the centred whole-house fit; following keeps the fly centred, and edge panning lets the player inspect opposite rooms. There is no game Overview button. Uniform grass uses static spatial batches and ordinary frustum culling; floors and rendered wall joins exclude blades. No simulation geometry changes.

[Exterior evidence](../assets/evidence/22/exterior-grass/README.md) records the prepared comparisons and close-range limitations. Root integration additionally passes production setup, follow, wheel zoom and wide/portrait resize restoration without browser errors. Final household materials and composed readability remain open.

The [warm-house integration](../assets/evidence/22/warm-house/README.md) retains authored materials and brings the first finished surfaces and native furnishings into both actual campaign levels. Detailed decoration, surface realism and lighting remain open.

The [fruit skin pass](../assets/evidence/22/fruit-skins/README.md) preserves authored geometry and contact exports while replacing neutral grey skin with asset-authored colour and roughness. Root integration passes both export identity tests, all twelve placement-model tests and TypeScript. The [apple skin integration](../assets/evidence/22/apple-skin/README.md) replaces regular radial stripes with authored irregular blush and pores, preserving exact contact geometry. Painted-looking patches and plastic shine remain open. The [banana detail integration](../assets/evidence/22/banana-skin/README.md) adds a portable authored peel image without changing canonical contact; soft close spots and repeated clusters still fall below the final realism target.

The [meadow refinement](../assets/evidence/30/meadow-tray/README.md) adds terrain variation, wind-driven grass and leaves, flowers and stones around both houses. The user's outdoor reference supersedes the earlier plain-lawn target; bounded rendering and final composed checks still apply.
