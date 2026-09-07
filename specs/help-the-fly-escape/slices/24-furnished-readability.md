# 24 — Follow visibility in a furnished room

Status: **current appearance accepted for MVP by the user, 2026-09-08**. Further visual refinement below is deferred under the [current visual acceptance](../GAMEPLAY.md#visual-target-a-warm-lived-in-house). Existing camera, asset ownership, collision and performance contracts remain required; final integrated functionality/resource checks belong to17.

## Contract, seam and review surface

Preserve selected-fly visibility, yellow circle and white trails around accepted realistic furnishings. Reassess the existing whole-prop vertical squash: it must not deform detailed furniture into implausible slabs. Use one renderer-owned occlusion policy, preserving core geometry. Camera selection/follow/zoom/RTS contracts remain fixed; do not remove real room colors for contrast.

Visual variable: occlusion/readability, judged at selected-fly/foreground-obstruction crops. Then run a separate compose acceptance using all previously accepted variables: twenty live flies, all-card panel, eating, seeking and repeated attempts. Measure final-room frame p95, input latency, buffer progress and retained resources. Failures return to their owning pass. Acceptance unlocks furnished five-room Level 1 and the larger second level; both need new frozen tuning/holdout evidence.

Include the accepted [exterior grass](22-house-surfaces.md#exterior-grass-pass) in this composed gate for both levels. At maximum zoom-out and all allowed pan extremes, across supported viewport sizes, every visible exterior ground region must remain grassy without a blank plane or patch edge. Preserve fly/ring/trail readability against grass and verify smooth rendering with uniform grass detail. The circular grass area may have a physical cutoff: coordinate its radius and camera zoom/pan bounds to keep that edge offscreen while retaining a view of the whole house.

## Standing verification and decision budget

Use the production renderer in the existing asset workbench, with a representative room, fixed cameras and recorded attempt. This is a diagnostic fixture, not a third campaign level. Preserve twenty real-connectome flies, neural ownership, deterministic replay and the current performance budgets. Blender renders are authoring evidence; actual browser captures determine acceptance.

For visual evidence, save full frames at default, close follow, further zoom and maximum zoom-out plus the named crops. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the preceding pass/reference and run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the last visual acceptance check. Open shots through [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); the five-minute feedback window is non-blocking while independent work continues. Record the verdict and close shots.

Delegated: reversible asset composition, implementation naming and measurements needed to resolve this slice's question. Record new physical assumptions before dependent implementation; do not silently change neuron dynamics, world scale, contact semantics or fidelity target. Update the global handoff and bank focused evidence under this slice's number. Deferred variables must remain frozen until their owning slice.

## Measured physical-food camera case

The slice19 3 mm fly/80 mm apple diagnostic places the macro Follow camera inside the nearby apple, hiding the selected fly even after correcting near-plane clipping; clear-floor Follow and closer zoom isolate successful scale framing. Preserve that fruit-adjacent pose as an occlusion regression. Food support and authored food volumes must participate in the same selected-subject occlusion owner as furnished room geometry. A frustum-visible subject is not proof of an unobscured subject. Do not hide this close-camera occlusion failure by flattening fruit or silently moving the camera/food in the regression fixture. Wide-zoom visual enlargement is now explicitly authorized in28.

The user explicitly permits zoom-dependent model enlargement to keep flies visible. Slice28 now owns the wide-view model/ring/click/trail adjustment; preserve native physical dimensions and verify that furnished-room occlusion remains readable with this display behavior.

Slice28 now supplies zoom-dependent model/ring sizing and verifies unchanged native close views. Preserve it during furnished occlusion work. Its close trail captures expose faint older paths against the neutral floor; reassess white-trail contrast with final materials, alongside the existing fruit-adjacent occlusion case.

## Furnishing integration regressions

The [native furnishing review](../assets/evidence/20/furniture-identity/README.md) preserves actual recorded sofa-adjacent subjects: subject11 loses body/leg contrast on upholstery at all near zooms; standard and subject12 overview hide the sofa behind the foreground wall while subject11 overview exposes it. Carry these full frames into the composed visibility gate alongside the unchanged fruit-adjacent disappearance. Materials22 and illumination23 own low contrast and weak contact shadows before24 judges the combined result.

The [domestic layout pass](../assets/evidence/24/domestic-layouts/README.md) implements the user's larger-room and ordinary-doorway corrections. Native furniture keeps its size; frames leave core openings clear. Current composed issues are sparse room identity and doorway overlap at whole-house framing. The outward-open French-window presentation is implemented; its door-like identity and glass realism remain visual acceptance issues.
