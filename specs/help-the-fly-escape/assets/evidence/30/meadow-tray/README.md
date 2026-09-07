# Meadow and object tray integration

The production houses now use the native fan and vinegar bottle in the world and in offline palette pictures. The fan faces its map-owned direction, cannot be rotated by the player, and remains limited to one. Fixed household clutter does not consume editable stock. Scent crumbs are absent from campaign inventories. Both the visibility toggle and its persisted preference are removed.

The first meadow pass adds taller grass, coherent wind sway, gentle hills beyond flat house approaches, scattered stones, wildflowers and drifting leaves. The fixed RTS camera remains ground-facing; the blue environment backdrop is not a new horizon camera. This is a first visual pass toward the supplied meadow reference, not final photorealistic acceptance.

The interface uses a warm object tray, a compact scene note and “Release the flies.” “Put objects away” clears only this arrangement, retaining stars and other levels. Normal play hides technical performance reports, seed numbers and computed-time counters; neuroscience explanations remain visible. Item descriptions and effect tooltips were subsequently removed at the user's request.

Validation: typecheck and production/WASM builds pass. The complete native sim suite passes with one existing ignored test; renderer suite47passes. Browser setup/edit/refund/cancel/reload/replay/storage-failure flow passes. A production20-fly second-house attempt ends with zero underruns and no page errors; all20starve, so no campaign-solvability claim follows. The final isolated attempt waited1.57seconds initially; this is one integration run, not the final hardware benchmark. Fan placement survives reload without page errors.

Review found an instanced-mesh GPU cleanup leak on meadow rebuild. Shared resource disposal now releases instance buffers, and the resize test verifies disposal events alongside geometry/material ownership.

## Visual critique

Fresh agent capacity was unavailable; adversarial fallback inspected full frames and tray/grass crops. Before/after full production frames are both1440×1000 and differ in1,113,419pixels above an8-level RGB threshold. Two stationary-camera grass frames600ms apart differ in93,101pixels, showing animation rather than a static replacement. This timing is observational, not a deterministic animation snapshot gate.

- Against acceptance: grass looks densely upright and bristly in the enlarged crop, with less broad blade shape and flower variety than the reference. Decision: accept first animated meadow integration; keep final vegetation art open.
- Against acceptance: rocks look pale and uniform in the whole-house frame, and rolling terrain is subtle around the flat foundation. Decision: preserve usable doorway approaches; further composition/detail remains open.
- Against acceptance: the native fan is small from whole-house scale, though its palette picture clearly shows a guard, blades and stand. Decision: inspect by zoom; do not enlarge its physical contact or secretly change its pose.
- Against acceptance: the cat still resembles a striped bun and laundry resembles folded fabric. Decision: source models remain provisional, not final household realism.
- Against acceptance: the setup still has a substantial sidebar despite its warmer styling. Decision: this removes technical controls and restores emphasis to the house; broader game-feel polish continues.

The complete capture set includes both houses, fan placement/reload and close wind frames. Older close frames retain earlier copy; final tray images show the current controls. The original failing household request is preserved in the neighboring evidence directory.

The developer console retains attempt identity, playback state and performance details, with normal progress logged at ten-second intervals and state changes rate-limited. Errors log explicitly and completion logs the final GPU estimate. Reports remain inspectable by the browser harness without appearing as normal game UI.

The current setup browser gate also asserts console attempt/playback events, no normal-play Download report button, no object effect tooltips, and no placed-object visibility control. It passes through replay and storage failure. A static-server run of the lab route initially404ed; the development server supplies that route and passed the full gate.
