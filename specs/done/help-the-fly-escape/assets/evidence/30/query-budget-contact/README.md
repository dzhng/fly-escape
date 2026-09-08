# Bounded motion request recovery

The production ten-attempt second-house check stopped on attempt four with `numerical motion unresolved: query budget`. Seed `10488929867879453175`, twenty flies and empty placements reproduce at native tick 58. The browser had received tick 50; this is not a playback underrun. The first three attempts completed at ticks 303, 309 and 310, each with zero underruns and 17 ms frame p95. This failed batch does not establish sustained release acceptance.

The captured request and failing native/browser reports pin build `4234737e8ce1a55779cfcd5ba016fdeb9260dfb984a778c580293113db90bf33`. The prior depth-limit repair resolves its recorded seed but does not cover query exhaustion. Motion work limits need a coherent typed outcome distinct from invalid input and geometry-query failures. A valid request that cannot be completed within fixed work should retain a proven-safe stationary pose; unchecked movement and increased budgets are not acceptable recovery. The native repair and focused tests pass; rebuilt-browser and sustained-attempt gates remain open.

`reproduce.rs` reads the preserved request from `/tmp/query-budget-request.json`. Copy the request there and temporarily place the source in the sim crate examples directory to reproduce with the workspace lockfile, then remove the temporary example. Native failure span: `[2.6341799586876142, 0.07454325579475889, 6.617922442047476]` to `[2.634211198261246, 0.07373055085445787, 6.617923249227317]`.

## Native repair

The motion owner now distinguishes typed work exhaustion from invalid input and native-query failures. It verifies the original pose before attempting a move, charging scene/support checks to the same fixed query budget. If query, segment, knot or substep work is exhausted, it discards provisional movement and spends the tick at that exact safe pose. Existing collision and depth-limit recovery retain verified prefixes. There is no unchecked movement, raised limit or public diagnostic flag.

The reduced captured request exhausts its work after 93 provisional points. It now returns two identical endpoints at the verified starting pose, within 512 queries. Both recorded swarm seeds complete: the new case at tick310 and the previous depth case at tick304. All65 focused native tests pass, including invalid pose/support, physical contact, eating and hazards. Root reviewed the typed error boundaries and shared physical-clearance predicate before integration, and reran the tests.

A broader rollback of depth-limit cases was rejected: changing the prior route exposed a missing rotated-support candidate at tick60. That failed experiment is preserved in `rejected-depth-rollback.log`; the final patch retains the already verified depth-prefix behavior. This is not universal contact-solver completeness.

## Rebuilt browser

The two captured second-house seeds complete at1× in the rebuilt production browser, matching native ticks310 and304 with20starved in each. Both report zero underruns, hardware ANGLE Metal on Apple M5 Pro, and a return to one Worker/canvas. The recorded input/build identities and results are in `browser-attempt-1.json`, `browser-attempt-2.json` and `browser-report.json`. This closes these reproduced aborts; random sustained retries and useful object effects remain separate gates.
