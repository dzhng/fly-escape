# Browser model preparation

The same GLB loader and WorldView now serve the workbench and playback. The workbench supports local replacement, three framing distances and orientation inspection; playback uses the authored model. [Browser checks](browser/checks.json) cover invalid replacement retaining the prior model and five replacements with stable GPU counts. The [camera checks](game-camera/checks.json) and [playback controls](playback-regression/checks.json) pass with the real model. Renderer tests verify finite actual-GLB bounds, independent skeleton transforms and rejection of geometry far from its pivot; the latter test was observed failing before the validation fix.

One loader defect was caught by the consumer: descriptive `extras.pivot` metadata was interpreted numerically by Three.js. Renaming the authored field restored finite skin transforms without weakening validation. Review also found a persisted-pagehide lifecycle issue; the workbench preserves its renderer when entering the browser history cache.

The current authored-scale result and remaining gates are in [scale review](scale-review.md). The initial captures below remain historical evidence: independent inspection exposed transparent wing visibility and oversized crowd overlap. The wing material correction and source-wide scale correction have since been checked in real browser captures. Final dependent acceptance remains open for overview marker clarity and the human checkpoint.

Three initial workbench views were opened in Preview at 17:35:52 UTC on September 6 and closed when the wing issue was identified. This initial review was not accepted by silence. Animation sampling, trails and final house art remain separate checkpoints.
