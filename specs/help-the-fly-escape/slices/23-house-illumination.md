# 23 — Daylight and household illumination

Status: in progress. Native decorative lights and room mounts are integrated; daylight, shadows and final illumination acceptance remain open. Dependencies: 22.

## Contract, seam and review surface

Replace the flat room illumination with believable warm-house light through the production renderer. Renderer environment/lighting owns presentation; core sensory sources remain authoritative for modeled visual inputs. Decorative household illumination is not automatically a gameplay cue. Any visible light intended to affect flies must map explicitly to the existing sensory source, with corresponding recalibration.

Use two sequential independently judged passes: daylight/exposure/shadow only with household lamps fixed, then household lamp emission/illumination with daylight frozen. Keep shapes and materials fixed. Judge window-lit surfaces, contact shadows and lamp-local crops; integrate only after both pass. Set color management once and measure shadow/environment texture ownership and rendering cost. Do not hide material errors by adjusting light intensity.

## Standing verification and decision budget

Use the production renderer in the existing asset workbench, with a representative room, fixed cameras and recorded attempt. This is a diagnostic fixture, not a third campaign level. Preserve twenty real-connectome flies, neural ownership, deterministic replay and the current performance budgets. Blender renders are authoring evidence; actual browser captures determine acceptance.

For visual evidence, save full frames at default, close follow, further zoom and maximum wheel zoom-out plus the named crops. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the preceding pass/reference and run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the last visual acceptance check. Open shots through [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); the five-minute feedback window is non-blocking while independent work continues. Record the verdict and close shots.

Delegated: reversible asset composition, implementation naming and measurements needed to resolve this slice's question. Record new physical assumptions before dependent implementation; do not silently change neuron dynamics, world scale, contact semantics or fidelity target. Update the global handoff and bank focused evidence under this slice's number. Deferred variables must remain frozen until their owning slice.

[Room-detail integration](../assets/evidence/23/room-details/README.md) adds native window and sconce mounts to both levels, retains authored materials and keeps household point lights active when foreground mounts are cut away. Final glass, daylight balance and composed illumination remain open.
