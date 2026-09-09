# Verification boundary

The frozen candidate passes the offline anatomical and channel-information checks. It is not an implemented retinal input map or evidence of downstream neural discrimination.

- Full existing connectome suite: **32 tests pass**. The focused tests cover exact quantized brightness matching, neutral gray, independent color information, spatially exchanged equal channel dose, missing-coordinate rejection, annotation identity and directed path orientation.
- Mutation check: replacing the blue coefficient vector with the luminance vector made both chromatic tests fail for the intended reason; restoring the source passed all three focused tests.
- Independent Codex review: no actionable defects. The reviewer reran the focused tests and reproduced the inventory, model and SVG byte-for-byte.
- Existing graph hash remains `6218f74521ca39652c59bd7524fb6aa5fe587058ce438a3fa08e4d8eee7cd454`; graph and manifest files were not changed.
- Shape/diff/docs review: one offline audit owner, reuse of existing signed-graph path traversal, no production current adapter or spatial map changes. Documentation links the model, inventory, source ledger and visual evidence instead of duplicating their complete tables.
- [Atlas telemetry](visual-metrics.json): every color patch center equals the expected sRGB display byte triplet after encoding its declared linear input; no baseline biological image is claimed. Both matched patches and their output labels are also retained as a [zoomed crop](matched-pair-crop.png).

Final unprimed visual review accepted the updated atlas: no remaining concrete layout/readability defect, with explicit 0–1 scale and sRGB encoding. The reviewer requested those two clarifications on the first pass; both are implemented. The zoomed matched-pair crop remains readable but needs the atlas for column headers and is supplementary only. Appearance is not scientific validation. Human review remains non-blocking; the integrating agent owns opening/closing the review images alongside the other slice's artifacts.

The combined spatial/current budget gate remains deliberately **pending slice 05**: no spatial weights have been invented here. The model requires one total visual budget, gain at most three and every mapped cell within its gain. Slice 05 must calculate the actual combined bound before either channel is injected. Chromatic proof must exclude all injected Tm2/Tm20 cells and use brightness-clamped, chromatic-off and equal-total-dose controls; a changed injected current alone is not proof.
