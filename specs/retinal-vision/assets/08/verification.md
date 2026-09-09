# Evidence verification and limits

Both frozen neural panels failed in both phases. This artifact records the verification of that outcome, not completion of the browser sensorimotor experiment.

The native probe uses the existing retinal adapter and Brain without changing graph or manifest bytes. Freeze records bind the exact source, graph, map, input files, exclusions, parameters and statistics implementation. The diagnostic and reserved confirmation packs differ only in phase/seed selection. All reports retain the full frozen identities. Archived inputs were not refreshed when live browser captures later changed.

The original held-out runs used Rust 1.94.1 on the project host (Apple M5 Pro, macOS 26.4.1 build 25E253). Slice 08 took 461.68 seconds wall time, with 3,256,713,216 bytes maximum RSS and 3,276,163,928 bytes peak memory footprint. Slice 09 took 302.61 seconds, with 2,128,168,952 bytes peak footprint. These are offline process measurements, not browser frame budgets; power state was not recorded. The original output implementation accumulated JSON observations across conditions, contributing avoidable memory overhead. Output-only streaming maintenance must preserve this source revision in history and create a new freeze for any future run.

Analysis used the project Python 3.14.6 environment, NumPy 2.5.2 and SciPy 1.18.1. Figure generation used isolated Python 3.11, NumPy 2.2.6, SciPy 1.15.3, Matplotlib 3.11.1 and Pillow 11.3.0. Every archive was decoded and SHA-256 checked against the original uncompressed file before duplicate removal. About 234 MB of report/analysis JSON is stored in 38.7 MB of gzip files; each evidence record retains exact byte counts and hashes.

## Figures

[Visual telemetry](visual-metrics.json) covers all 50 PNGs and 12 comparisons. The plots show every primary contrast and every supplied input condition; each response row has its own readable crop. Both phases use the same byte files. The enlarged color overview and tight color-patch crops are byte-identical across phases; displayed patch colors agree with their sRGB-transformed source within one byte. Some input overview labels rasterize slightly differently across phases, so whole overview equality is not claimed.

Direct adversarial inspection covered the actual scene/occlusion input pages, color controls and tight patches, all held-out response rows, and full downstream count bars. Scene images retain distinct floor, sky, wall, sofa, marker and apple signals. The opening blockers alter localized eye content and do not produce a dark substitute image. The sparse one-sample stimuli are necessarily tiny in overviews; tight color crops expose the actual two-color swap. Most endpoint intervals lie near zero, and large intervals compress smaller signals; numerical counts and full JSON are necessary to interpret that plot honestly. No clipping or missing panel was observed in those inspected images.

A fresh unprimed screenshot review is pending; direct inspection is not an independent visual sign-off. Final independent code review found no actionable findings and separately confirmed archive integrity, source/input identities, unchanged confirmation protocols and downstream accounting. Its default Python lacked SciPy, so it did not independently recompute the intervals. Earlier independent code review ran the native control tests and freeze-only preflights. Existing interval-helper tests pass (7), as do retinal-map (3), retinal-tick (7), and the native probe control test (1).

## Choices requiring future evidence

The 438 endpoint cells are a frozen audited path-witness union, not a claim to exhaust downstream visual processing. Full counts for 40,944 downstream cells preserve the distinction. The single-sample equal-dose patches and integer-doubled color levels were chosen before execution; their small support and transfer saturation may limit sensitivity. Neither broader populations nor larger patches were substituted after seeing results. Motor channels remain descriptive only, with all motor/readout cells excluded from endpoints. Any new endpoint or stimulus area requires a new preregistration and fresh seeds.

## Output maintenance after the frozen runs

Commit `ea17454f` preserves the exact native source used by all four archived experiments. The following output-only cleanup writes and flushes one completed condition at a time, releasing its JSON values before computing the next. It does not change neural loops, seeds, parameters, currents, endpoints, exclusions or criteria. Interrupted output remains incomplete JSON with the existing started marker; output files still require create-new semantics. Existing freezes intentionally reject the changed source. No neural rerun was used to replace these outcomes.

A focused file-based test failed when the per-condition flush was omitted, then passed with incremental flushing; it checks the first condition is visible before evaluating the next and checks finished JSON values. Both native probe tests pass. A second independent code review found no actionable issue in this maintenance diff; it confirmed computation/criteria are unchanged and the output test is meaningful. No reduced-memory numerical claim is made without a new measured run.
