# Failure-state recovery

A producer failure freezes recorded playback, but resizing the canvas still requires a draw. Previously the shared failed flag stopped both, so resizing erased the house and flies. Drawing now continues from retained scene state and frozen replay time. A renderer exception separately stops drawing, avoiding a new exception on every animation frame.

The production browser test injects a Worker error after playback advances, pauses, then changes and restores viewport size. The old build fails its exact canvas-pixel restoration assertion; the new build passes. It also verifies that a deliberately broken WebGL draw executes only once, both failures permit a new attempt, and the narrow neural panel remains scrollable. This is view/retry coverage, not proof of native WASM recovery after every possible trap.

Normal game errors give a short interruption message and Back to setup action. The original technical cause remains in the developer console; diagnostic lab views retain detailed errors. Reports preserve the expected injected errors and the static server's incidental favicon404 separately from page exceptions.

[Before](before/restored.png) and [after](after/restored.png) show the visible change. All three viewport states per build are retained. Independent review confirms clear interruption labels and an unobstructed recovery action across the candidate views. White trail clutter remains a separate visual issue; it does not obscure recovery controls. The browser checks verify scrolling for lower cards rather than inferring it from a cropped screenshot.
