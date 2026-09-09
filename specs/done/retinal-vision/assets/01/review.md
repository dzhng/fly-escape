# Reference replication verdict

**Pass for the slice's explicitly allowed original-sampler scope.** The pinned Retina functions actually ran under Python 3.11.16 / NumPy 2.2.6 / Numba 0.61.2 on macOS arm64. No MuJoCo render, articulated model or pursuit result is claimed. Product runtime and dependencies are untouched.

The source-derived neutral rig has proper rotation determinants, left/right optical forward vectors with opposite source-Y signs, and upward camera vectors. Generated raster landmarks retain their horizontal and vertical ordering through the original fisheye and sampling path. Eye-specific center colors and target movement change actual sampled outputs. Uniform fields yield zero response to red, 505 green-selecting cells, and 216 blue-selecting cells; the approximation is deliberately exposed rather than used as final RGB input.

Each of four eye/time cases agrees with an independent per-ID channel mean to a maximum absolute error of `5.662137425588298e-15`. Original display truncation causes at most one byte-level difference at 12.7–16.6% of pixels; the comparison's amplified images preserve those differences. The independent oracle does not reimplement the fisheye or replace the original sampler. A rerun with a new source cache and output folder produced byte-identical PNG, JSON, NPY and NPZ artifacts. See [the exact recipe](reproduce.md) and machine-readable correspondence and metrics linked there.

## Visual judgment

Target: six asymmetric landmarks should remain traceable through the source projection and sampled layout, upper/lower and left/right should not reverse, and the moving target should remain distinct from static landmarks. Pure-red information is expected to disappear because of the source's declared channel rule.

The original display and independent pooling oracle are comparable at identical pixel dimensions, fixture inputs, layout and frame. Their only measured differences are one-level truncation effects; neither is a visibly better optical representation. This is numerical corroboration of the reference, **not** a comparison against a MuJoCo screenshot or external video. The synthetic sparse-color fixtures have retinal quantized-color entropy 2.56–2.66 bits and mean Sobel energy 45–50; low entropy reflects the deliberate small palette and does not indicate an empty capture.

Direct inspection covered the contact sheet and enlarged eye interior; an initially unprimed agent inspected every one of the 21 PNGs without code or project context, then inspected the entire revised set. Its first critique found that frame-zero's dark target touched the blue landmark and that the sheet did not explain sample speckling or amplified diffs. The fixture now leaves a visible gap, and every stage has numbered overlays plus a self-contained legend. The last visual check judged the evidence interpretable, the target distinct across frames, and found no visible blur or orientation reversal.

Retained observations: the cyan left-eye center boundary has weak contrast in the source's G/B mosaic; it remains labeled and the unannotated outputs preserve that limitation. Some overlays cover small landmark areas; standalone inputs and outputs stay unannotated. Standalone amplified difference images need the sheet's scale legend. White/partial edge cells belong to the original display, not to a repaired crop. These are acceptable for scoped source replication, not acceptance of final color-preview quality.

The parent task owns the single Preview checkpoint so concurrent workers do not close each other's shots. Human silence does not change this bounded evidence verdict.

## Closeout review

Shape: one isolated reproduction harness owns fixture generation and evidence; original source remains fetched and hash-pinned outside the product. No adapter, controller, module boundary, runtime dependency or production code was added. The existing generic screenshot helper lacked its Node dependencies, so this harness uses already-pinned NumPy/SciPy metrics instead of installing product packages.

Diff: independent `codex review --uncommitted` reported no actionable defects after Python syntax and JSON validation; it did not run the reproduction. The owning agent ran the actual experiment and full byte-repeat check. Subsequent changes were fixture separation and evidence labels, reviewed directly and through the last visual pass.

Docs: the slice links the reproduction recipe and verdict; the recipe links profile, correspondence and source provenance. Geometry placement on the actual fly asset, final RGB pooling, final sample order and real renderer orientation remain later contracts rather than claims hidden in this result.
