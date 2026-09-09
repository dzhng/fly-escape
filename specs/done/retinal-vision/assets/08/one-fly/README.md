# One fly, captured inputs, native reconsumption

The `/retina` diagnostic runs the production worker for 24 ticks with one native
walking fly at the authored first-room start. It uses the accepted 128×128 cameras,
721 samples per eye, ordinary campaign cues and seed42. Native code owns movement
and the pre-neural pose. The separate fixture controls do not alter this run.

[The exported recording](consumed.json) contains the exact start request,
configuration, consumed RGB batches and resulting frames. The
[browser test](../../../../../tests/browser/retina-one-fly.mjs) scrubs ticks1,12,24,1
and compares both canvases byte for byte with the archive's display conversion.
It also verifies that releasing the history slider does not trigger fixture capture.

The native `retinal_reconsume` example loads those same bytes through the same
Attempt transaction. Every pending full-pose request matches exactly. The complete
returned frames match the browser archive: integers and metadata exactly, and875
floating comparisons within a declared relative tolerance of1e-12. The largest
absolute difference is1.6653345369377348e-16. No field is excluded. The prior
placeholder directional-vision mismatch disappeared when that obsolete field was
removed from both runtime and decoder; no normalization hides it here.

Run `bun run test:retina-one-fly` with the asset workbench serving port5174 and the
current WASM/assets built. Set `RETINA_URL` and `RETINA_ONE_FLY_OUTPUT` for another
server/output directory. This is an integration proof of capture, consumption,
recording and body correspondence. It does not establish stimulus-dependent
responses beyond injected cells; the separate frozen neural protocol owns that gate.

Independent code review found and corrected two defects: the history slider was
caught by the fixture's broad range-input listener, and computation retained the
previous capture-wait label. Fixture handlers are now scoped, and native progress
reports the active stage. The final fresh visual reviewer found the recorded
eyes and controls clear at both widths. Its diagnostic JSON clipping observation
was checked against the live element: scrollWidth equals clientWidth (388px),
text wraps, and the intentionally180px-high report scrolls vertically. Exact
identities are also available in the export. This expected scroll boundary is
accepted; it does not hide or truncate data. The recorded tick now appears next
to the slider as well as below the images.
