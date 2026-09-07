# 28 — Fly models stay visible as the camera zooms out

Status: accepted implementation; browser checks and visual review complete. Dependency:25 physical adoption. User steering2026-09-07 explicitly permits fly model enlargement at wide zoom; exact visual proportionality is no longer required there.

## Contract and seam

The existing renderer enlarges every fly continuously with camera zoom so its full model remains recognizable at room Overview, and returns to native size at close follow/extra-close. Use one shared display scale derived from the WorldCamera's target distance, vertical FOV and CSS viewport height. Start with a24 CSS-pixel minimum span for the model's longest native dimension; never shrink below native size. A common zoom scale avoids a selected-subject feedback loop and keeps neighboring flies comparable. Its exact minimum is a reversible visual choice, refined from browser evidence.

The renderer owns this presentation scale. Physical bodies, antenna sample positions, food contact, neural dynamics, replayed trajectories and all level geometry remain unchanged. Native asset dimensions remain metre-correct. Do not alter camera close-distance calibration from inflated bounds, teleport body poses, or replace models with icons. Preserve imported root transforms by multiplying a stored native scale instead of compounding frame-to-frame scale.

The yellow selection circle, click/raycast geometry, visual follow centre and trail head gap must agree with displayed size. Keep the selected fly centred during zoom, and preserve RTS pan/unfollow. Follow uses the displayed centre while close-distance calculation retains the native model. No black/blue selection decoration. The field lab's scientific sample markers remain actual coordinates, and any dimension-diagnostic label distinguishes display scale from physics.

## Evidence

Focused camera/scale tests cover native close size, continuous monotonic zoom compensation, viewport resize and no cumulative scaling. Browser captures show20 models at Overview/context and the unchanged close-up, then select via visible model and card, zoom both ways, and verify follow centring. Rewind must retain the same poses and displayed scale at the same camera settings. Check the yellow ring and white trail gap alongside the enlarged geometry.

Compare against the user-supplied empty-looking Overview and the native close baseline. Judge readability and zoom transitions only; furniture/material/lighting realism and fruit occlusion remain separate. Use compare-screenshots and screenshot-critique as the final visual gates, with the documented fallback only if a fresh reviewer remains unavailable. Open the smallest useful Preview set for a non-blocking checkpoint and continue independent work during its feedback window.

Delegated: implementation naming and reversible minimum span refinement from visual evidence. The common zoom scale, native close size, physical invariants and affected presentation consumers are fixed above. Update24 and the global handoff after this slice.

Implementation and adversarial review: [evidence28](../assets/evidence/28/README.md). Native follow/close pixels are unchanged; compensated models are pickable, and recorded replay remains exact.
