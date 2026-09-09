# Preliminary complete-campaign resource evidence

These production builds used real acquisition, the accepted 721-sample RGB map,
and the production archive/playback owners. They preceded the final paired-eye UI
and removal of the old visual metadata, so they do not replace the final cutover gate.

Both reports use sixteen flies and a diagnostic 6,000-tick horizon. The second
room's authored shorter campaign timer is preserved in the product. The horizon
is a resource stress case, not a campaign content edit. Seed 42 is a repeatable
resource fixture, not evidence of robust visual navigation.

The measured archives use about 490 MiB, within the engineering target of 512 MiB.
Variable body motion can still exhaust the bounded archive; the explicit error
path remains necessary. These measurements do not prove every possible arrangement
fits. The report retains observed JS heap, WASM memory, production time, frame
latency, seek results, hardware renderer and errors rather than substituting raw
RGB arithmetic for a complete run.

Reproduce through `tests/browser/build-retina-budget.mjs` and
`tests/browser/retina-campaign-memory.mjs`; use the final rebuilt production
fixture for acceptance. The original measured files are retained unchanged here.
