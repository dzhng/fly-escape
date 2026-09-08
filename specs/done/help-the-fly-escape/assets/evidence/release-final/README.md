# Local production release check — 2026-09-08

The static production build completed the two-level campaign with fresh progress. This closes functional MVP acceptance under the user's instruction to ship somewhat-working mechanics without further extended balancing. It does not establish broad stochastic reliability or calibrated difficulty.

| Check | Result |
| --- | --- |
| First house, 20 flies, no added objects, 10 simulated minutes | 2 escaped, 18 timer deaths, zero underruns |
| Second house, 20 flies, no added objects, 5 simulated minutes | 6 escaped, 14 timer deaths, zero underruns |
| Earned unlock and reload | Both results persisted, second level unlocked by first-level star |
| Controls | Pause, selection, both speeds, rotation/reset/zoom, replay and retry passed |
| Static distribution | No page errors, failed HTTP responses or external HTTP requests |
| Firefox 155 / WebKit 26.6 | Setup rendering, twenty-fly frame production and cancellation passed |
| About | Root navigation, keyboard link, data provenance, manifest, mobile width and return passed |

[Campaign assertions](campaign/checks.json), [first-house telemetry](campaign/level-1.json), [second-house telemetry](campaign/level-2.json), [platform scope](platforms/report.json), and [About log](about.log) are the raw evidence. Campaign reports include seed and graph/simulation/content identities. The harnesses are captured beside this report; their temporary output paths record this run.

Initial waits were 85.7 seconds and 38.8 seconds; frame-interval p95 was 17 ms in both runs. Earlier standalone first-house evidence reached 115 seconds initial wait and 34 ms frame p95. Startup and general performance targets therefore remain unmet. Firefox/WebKit smoke is not a full campaign or real Safari performance qualification. This is one complete campaign, not the former ten-attempt soak gate; earlier contact regressions were repaired and covered by native tests, but rare unobserved failures remain possible.

The final build succeeded. The graded sensory integration passed 165 simulation tests (one preexisting ignored test), 31 client tests and independent code review. [The matched graded-browser comparison](../33/graded-browser/README.md) records 2 escapes without added objects versus 5 with a banana for one seed. These observations support usable placement influence, not guaranteed attraction, validated repulsion, or balanced star frequencies.

Long soak testing, holdout calibration, the proposed roughly ten-percent three-star rate, 100-fly qualification, startup optimization and remaining cosmetic refinement are deferred. Star thresholds stay 1/8/15; normal emission applies to all objects. No global or banana-specific tripling ships.

The complete default test command (including web UI tests) passed; see [test output](all-tests.log). After archive-path updates, the [final rebuild](archive-build.log) passed. The simulation-source change since captured campaign telemetry is solely its evidence-link comment, so the rebuild changes build identity but not behavior. [Final visual review disposition](visual-verdict.md) records remaining presentation limitations.

The [documentation audit disposition](documentation-verdict.md) closes the final claim review; [whole-run size accounting](size.md) records maintenance scope. The [post-archive static About check](archive-about.log) also passed against the rebuilt distribution.
