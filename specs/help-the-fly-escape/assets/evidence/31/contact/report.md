# Dense-grid and halved-step evidence for the provisional 3 µm contact gate

Scope: gate 1 of `specs/help-the-fly-escape/slices/20-furnished-contact.md` — "Preserve query
regression precision. The provisional numerical ceiling is 3 µm additional trajectory/replay error
relative to the chosen hull, targeting zero penetration; reject measured excursions above it. Use
dense temporal checks and halved-step convergence as empirical evidence, not a proof at every
instant."

No production behaviour was changed. The only source edit is a `#[cfg(test)]` scratch test appended
to `crates/sim/src/body/motion_consumer.rs` (`crates/sim/src/body.rs:852` gates the whole module
behind `cfg(test)`). Patch retained as `scratch-test.patch`; it is not committed.

Worktree: `/private/tmp/fly-contact-evidence` at `6a56bde`. Build: `cargo test -p sim --release`
with `CARGO_TARGET_DIR=/tmp/fly-contact-evidence-target`. darwin arm64, single machine.

## What was measured

For each fixture the current production producer (`motion::advance`, native hull from
`assets/fly/contact-hull.json`) generates one `MotionTrace`. The trace is then read back through
the authoritative core sampler `MotionTrace::at(fraction)` on a uniform per-segment temporal grid,
and again on the halved grid (twice as many sub-intervals per segment, i.e. step h and h/2 over the
same trace). At every sampled pose three existing queries are evaluated — no new solver, API or
abstraction was added:

| quantity | helper | applies to |
| --- | --- | --- |
| scene penetration | `ContactScene::penetration(hull, root, rotation)` | every sample |
| neighbour penetration vs the selected support | `ContactScene::neighbor_penetration(hull, root, rotation, support_id)` | grounded samples whose scene has another surface |
| root deviation vs the support query | `abs(ContactScene::support_at(hull, support_id, [x,z], heading, motion::up(rotation)).root[1] - height)` | grounded samples holding a support id |

The root-deviation metric is exactly the quantity the supported producer refines against
(`crates/sim/src/body/motion.rs:872`, trigger `MOTION_ERROR * 0.5` = 1.5 µm) — evaluated here at
interpolated poses the producer never validated, which is the point of the exercise.

This is a temporal-grid refinement of one fixed trajectory. No body was simulated twice at
different `dt`, and no result here is presented as interpolation convergence of the physics.

## Fixtures (6)

Four are the existing supported-apple requests from `motion_requests_advance_within_budget`
(authored apple `assets/food/apple/contact.json`, production native hull, catalog fan speed, 0.1 s
tick): `upright-fan`, `aligned-fan`, `center-fan`, `max-neural`. Two are the existing worn-shoe
neighbour fixtures: the supported rim walk from
`native_shoe_rim_blocks_supported_motion_without_aborting_the_tick` (support id 25, two shoe
surfaces present) and the descending rim landing from
`descending_shoe_rim_contact_keeps_a_verified_prefix`.

## Results

Raw stdout: `scratch-dense-grid.log` (exit code 0). Parsed: `dense-grid-results.json`.

Grid: 256 sub-intervals per segment (coarse) and 512 per segment (halved). Samples are taken at
both segment endpoints, so joins are visited twice; the counts below are the exact evaluated
sample counts, not a nominal figure.

| fixture | knots | segments | producer queries | coarse samples | halved samples |
| --- | --- | --- | --- | --- | --- |
| apple/upright-fan | 95 | 94 | 232 | 24 158 | 48 222 |
| apple/aligned-fan | 87 | 86 | 217 | 22 102 | 44 118 |
| apple/center-fan | 122 | 121 | 306 | 31 097 | 62 073 |
| apple/max-neural | 123 | 122 | 321 | 31 354 | 62 586 |
| shoe/supported-rim-walk | 17 | 16 | 81 | 4 112 | 8 208 |
| shoe/descending-rim-landing | 12 | 11 | 81 | 2 827 | 5 643 |
| **total** | | | | **115 650** | **230 850** |

Every sample carries one scene-penetration query: 115 650 coarse + 230 850 halved = **346 500
penetration evaluations**. Root deviation was evaluated on grounded samples holding a support id:
90 975 coarse + 181 599 halved = **272 574 support queries**. Neighbour penetration was evaluated
on 6 426 coarse + 12 826 halved = **19 252 samples**, all from the two shoe fixtures.

Maxima, in micrometres:

| fixture | pen. (coarse) | pen. (halved) | Δ | root (coarse) | root (halved) | Δ |
| --- | --- | --- | --- | --- | --- | --- |
| apple/upright-fan | 0.986268 | 0.986594 | +0.000326 | 2.202554 | 2.202554 | +0.000000 |
| apple/aligned-fan | 1.217878 | 1.217878 | +0.000000 | 1.869112 | 1.869112 | +0.000000 |
| apple/center-fan | 1.707816 | 1.714557 | +0.006741 | 1.736398 | 1.741566 | +0.005168 |
| apple/max-neural | 1.711005 | 1.714850 | +0.003845 | 2.383168 | 2.388602 | +0.005434 |
| shoe/supported-rim-walk | 1.282200 | 1.282200 | +0.000000 | 1.290252 | 1.292591 | +0.002338 |
| shoe/descending-rim-landing | 0.00000088 | 0.00000088 | +0.000000 | 0.003130 | 0.003722 | +0.000592 |

- **Worst measured penetration: 1.714850 µm** (apple/max-neural, halved grid).
- **Worst measured root deviation: 2.388602 µm** (apple/max-neural, halved grid).
- **Worst measured neighbour penetration: 0.000000 µm** — every neighbour query on the 19 252
  shoe-fixture samples returned `Penetration::Depth(0.0)`.
- **`Penetration::Contained`: 0 occurrences** across all 346 500 penetration queries and all
  19 252 neighbour queries.
- **Unresolved support queries (`support_at` returning `None`): 0** across all 272 574 root queries.

Halved-step convergence: halving the step changed the maximum by at most **+0.006741 µm**
(penetration) and **+0.005434 µm** (root deviation) on any fixture. The remaining margin to the
3 µm ceiling at the halved grid is **0.611398 µm** (max-neural root deviation), which is ~113×
the largest observed step-halving increment. On this evidence the dense grid has resolved the
maxima and no fixture approaches the ceiling.

Note that root deviation reaches 2.39 µm — above the producer's own 1.5 µm refinement trigger,
below the 3 µm ceiling. That is expected: the trigger is applied at the producer's validation
samples, and interpolated poses between retained knots are free to exceed it. Measuring that
excess is the empirical content of this gate.

Determinism: the test was run twice; both runs printed byte-identical maxima for all six fixtures.

## Relation to the historical `numerical-knots/fan-results.json`

That file is a different producer. It reports `upright-fan` at 76 native knots / 177 queries and
`center-fan` at 114 knots / 276 queries; the current producer yields 95/232 and 122/306 for the
same named requests, and its aligned fixtures no longer settle identically. Its maxima
(penetration up to 2.333 µm, root up to 2.685 µm) are therefore not the current numbers and were
not used as a baseline here. The rejected 3.303 µm midpoint-only miss recorded in that README
belongs to an unadopted variant and is not reproducible against the current source; nothing in
this measurement reproduces it either.

## Precision and coverage limitations

1. **Not an independent oracle.** Penetration and support depth are measured with the same
   `ContactScene` queries the producer uses. This shows internal consistency of the retained
   trajectory with the contact geometry; it cannot detect an error shared by both. The queries'
   own classification precision is `CONTACT_PRECISION = 1e-8` m (`crates/sim/src/body/motion.rs:12`),
   i.e. 0.01 µm, which bounds the resolution of every figure above; differences below ~0.01 µm are
   at the noise floor.
2. **Empirical, not continuous.** 512 sub-intervals per segment is dense sampling, not a proof at
   every instant. The step-halving deltas are evidence that the grid resolves the maxima; they are
   not a bound on the true supremum between samples.
3. **Neighbour coverage is narrow.** The apple fixtures contain one contact surface, so
   `has_other_surface` is false and they contribute zero neighbour queries by construction. All
   neighbour evidence comes from the two worn-shoe fixtures (19 252 samples, one prop, two
   surfaces). Neighbour clearance across the full furnished catalogue is not covered.
4. **Departure intervals are excluded from root deviation**, because the producer marks them
   non-grounded; consistent with the existing README note that departure upper-support differences
   are not valid supported-path accuracy evidence. No departure interval is claimed here.
5. **Replay is unmeasured on the replay side.** `packages/sim-client/src/record.ts:329`
   (`sampleMotion`) delegates to the core's pure sampler through WASM, so the interpolation math
   has one owner and the knots are stored as f64. But no WASM build, browser run or archive
   round-trip was executed in this task. Everything above is the native build of that shared
   sampler.
6. **Six fixtures, one seed-free controlled setup each, release build, single machine.** These are
   representative supported requests, not a campaign workload or a worst case. Timing was not
   measured and no performance claim is made.

## Existing tests re-run after the measurement

| command | result |
| --- | --- |
| `cargo test -p sim --release --lib body:: -- --skip scratch_dense_grid` | 26 passed, 0 failed (exit 0) — `existing-lib-body-tests.log` |
| `cargo test -p sim --release --test body` | 27 passed, 0 failed (exit 0) — `existing-integration-body-tests.log` |
| `cargo test -p sim --release --lib surface` | 6 passed, 0 failed (exit 0) — `existing-surface-tests.log` |
| `cargo test -p sim --release --lib -- --exact body::motion_consumer::scratch_dense_grid_and_halved_convergence_evidence` | 1 passed (exit 0), 171.58 s — `scratch-dense-grid.log` |

## Exact remaining gate

The dense-sampling and halved-step half of gate 1 is now measured against the current producer:
zero penetration excursions above 3 µm, zero containment, worst penetration 1.71 µm, worst root
deviation 2.39 µm, converged under step halving, on 346 500 penetration and 272 574 support
queries over six fixtures.

What gate 1 still lacks, stated precisely:

- **The replay leg.** "trajectory/**replay** error" is only half proved. The archive round-trip and
  the WASM sampler were not exercised here. Proving it needs a recorded archive read back through
  `RecordChunk.sampleMotion` in a WASM build and compared against the native `MotionTrace::at`
  values at the same fractions. That is a JS/WASM harness, not a Rust helper; the existing Rust
  helpers cannot make the claim.
- **Neighbour breadth.** Neighbour clearance is measured on one prop. Extending it to the rest of
  the furnished catalogue is more fixtures of the same shape, not new machinery.
- **The gate remains provisional.** 3 µm is a chosen ceiling, and the deferred 0.25 CSS-pixel
  appearance target is untouched by this work.

Nothing in this report addresses gates 2–4 (recorded contact lifecycle, sustained twenty-brain
cost, visual review).
