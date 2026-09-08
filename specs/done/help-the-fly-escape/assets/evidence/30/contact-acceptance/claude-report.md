# Contact acceptance repair — L1 apple/vinegar warmup pilot

Worktree `/tmp/fly-refinement-fix`, baseline `acebdfd`. Production + regression diff only,
no commits. Scratch artifacts and logs: `/tmp/claude-contact-acceptance/`.

## 1. Exact cause

Both focus cases are the **same defect seen from two sides**: the motion owner moved a body
onto a pose it never proved, and then reported the resulting overlap as a library failure.

### The unproven move

`advance_bounded` accepts a free-motion destination and a floor landing on the strength of
`ContactScene::cast_at_rotation` alone. That cast is a *search*, not a proof:

* it filters triangles by a separating-face-plane test (`surface.rs` `cast_on`), and
* it runs with `stop_at_penetration: false`, so a hull that is already exactly touching a
  mesh is not reported as blocked — the cast looks for the *next* impact.

So a fly resting on a prop can be handed a destination that is inside the prop, and the loop
appended it without a penetration query. Every later query then reads a penetrating pose.

### The misfiled query result

`ContactScene::penetration_on` returned `Err("numerical contact unresolved: hull interior is
inside closed food")` whenever the hull centroid landed inside any closed mesh. Two problems:

* the condition is a **physical fact about the proposed pose** (deepest possible overlap),
  not a malformed query or a library failure, yet it travelled as `MotionFailure::Invalid`
  and aborted `Attempt::step` and the whole swarm;
* the message is a misnomer. Every campaign occurrence was a closed **native prop** part —
  the sleeping cat and the worn shoes — not food at all.

### The two focus seeds, measured

| Cell | Fly / tick | Prop | Measurement |
|---|---|---|---|
| cold `vinegar` seed 102 | fly 6, tick 64 | sleeping cat (fixed object 4, surfaces 34–52) | request start verified clear (depth `2.9e-16`); after one 0.02 s substep the *accepted* pose is 0.918 mm inside closed cat component 43 and its centroid is contained |
| cold `empty` seed 105 | fly 14, tick 123 | worn shoes (fixed object 3, surfaces 2–33) | request start verified clear (depth `0.0`); the grounded landing tilt passes `rotation_clearance` but leaves the hull 5.85 µm (> the 3 µm allowance) inside the shoe |

In the cat case the containment error fired at the *re-verification* of an already-accepted
point (`motion.rs:494`), which is why it looked like a start-pose problem: the start was fine,
the previous substep was not. In the shoe case the same unverified acceptance produced
`"blocked free motion has no verified nonpenetrating start"`.

Two further distinct failures surfaced once the seeds ran past their old abort tick. Both are
the same acceptance contract and were fixed with it (see §3):

* `support disappeared while changing orientation` — a support root that samples upright but
  not under the tilt toward its own normal was treated as a malformed query;
* `numerical departure unresolved: planar request enters blocking contact` — a blocked planar
  departure aborted after the body had already been stripped of its support.

## 2. Why proposed-vs-original is safe

The distinction is not "ignore overlaps", it is **who owns the pose**.

* The **request start** is owned by `validate_start`, which still runs first, still shares the
  query budget, and still refuses any start that penetrates — containment included. An invalid
  original pose is preserved as an error (`initial body penetrates native contact`), pinned by
  `an_initial_pose_inside_a_closed_surface_stays_an_error`, which feeds `advance` the exact
  contained pose the cat case used to produce and asserts it still fails.
* A **proposed candidate** is owned by the motion loop. Detected containment or overlap there
  means the proposal is physically blocked. It is now typed as such and declined; the body is
  never moved onto it.
* Declining is not "accept unchecked movement": it is the opposite. Every pose the body is
  moved onto now carries an explicit `penetration` proof at the same `MOTION_ERROR` allowance
  that admitted the start, and the traversal assertions in the new tests check the *interpolated*
  poses too, not just the knots.
* Recovery reuses the existing owners, with no parallel fallback path:
  * a candidate blocked **with** a verified prefix holds that prefix for the rest of the tick —
    the shape the impact-penetration branch already used;
  * a candidate blocked with **no** verifiable prefix returns typed `MotionFailure::Blocked`,
    which lands in the *same* `advance` arm as the existing budget limits and reverts to
    `MotionTrace::stationary(state)` — the start `validate_start` already proved.
* Genuine malformed input and library failure stay `Err(String)`: `checked_pose`, non-unit
  quaternions, `"unsupported contact pair"`, mesh validation, `stop_supported`'s retained-pose
  check. `Penetration` is not serialized and derives no `TS`, so no schema moved.

Query and precision limits are untouched: `MAX_QUERIES` 512, `MOTION_ERROR` 3e-6,
`CONTACT_PRECISION` 1e-8, `work.segments` 128, `MAX_MOTION_POINTS` 129. Actual authored
geometry is used throughout; nothing was loosened, retriangulated or snapped.

## 3. Diff scope

`crates/sim/src/surface.rs` (+34/-14)
* new `pub enum Penetration { Depth(f64), Contained }` with `exceeds(allowance)`;
* `penetration` / `neighbor_penetration` / `penetration_on` return it; containment becomes
  `Ok(Penetration::Contained)` instead of an error string.

`crates/sim/src/body/motion.rs` (+215/-…)
* `verified(world, root, rotation, work)` — proves one candidate pose;
* `hold(world, trace, point, work)` — retains the verified prefix, or returns `Blocked`;
* new typed `MotionFailure::Blocked`, routed into the existing stationary-recovery arm;
* free-motion destination and floor landing are proven before acceptance (was: unchecked);
* candidate impact, blocked-rotation start, departure interpolation, and the supported-knot
  neighbour checks all go through the typed overlap;
* an absent tilted support root now falls through to the departure the owner already has,
  instead of `ok_or(...)`;
* the departure is validated in full into a local buffer and only *then* committed, so a
  blocked departure leaves the body supported where it was rather than support-stripped;
* `validate_start` and `stop_supported` keep their errors, containment folded in.

`crates/sim/src/body/motion_consumer.rs`, `crates/sim/tests/body.rs` — tests only.

No neural, sensory, gain, art, schema or dependency changes. No new visual certificates.
`cargo fmt --check` clean; `cargo clippy --workspace --all-targets` adds no new warning (the
single pre-existing one is in `examples/physical_sampling`).

## 4. Red → green evidence

Build: `CARGO_INCREMENTAL=0`, `--locked` (workspace `Cargo.lock`), release.

### Unit level

Red first, on baseline `acebdfd`, in a minimal self-contained world (one authored first-house
room + the single native prop at its map pose):

```
scratch_campaign_cat_containment  -> Err("numerical contact unresolved: hull interior is inside closed food")
scratch_campaign_shoe_start       -> Err("blocked free motion has no verified nonpenetrating start")
```

Green after, as five new regression tests in `motion_consumer.rs`:

| Test | Pins |
|---|---|
| `free_flight_into_a_closed_cat_part_holds_the_verified_pose` | cold s102 vinegar fly 6 tick 64; start proven clear, tick completes at fraction 1 holding the start pose |
| `landing_tilt_that_overlaps_a_shoe_holds_the_verified_pose` | cold s105 empty fly 14 tick 123; same |
| `a_blocked_departure_keeps_the_walking_fly_on_its_support` | cold s103 vinegar fly 5 tick 147; blocked departure does not cost the body its support |
| `an_absent_tilted_support_root_departs_instead_of_aborting` | same fly one tick earlier; the tilt is refused, the body leaves that root and the tick still moves |
| `an_initial_pose_inside_a_closed_surface_stays_an_error` | invalid original pose still errors |

Each motion test also asserts every interpolated pose along the trace clears contact.

Suite: **142 passing, 0 failing, 1 ignored** (`cargo test --release --locked --workspace`) —
137 pre-existing (all green, including the captured L2 shoe-rim regression seeds in
`motion_consumer.rs` and `tests/body.rs`) plus the 5 above.

### Pilot level

All 13 previously-failed cells rerun under the new core, cold from
`inputs/cold.patch` and warm60 from `inputs/warm60.patch` (init experiment only):

```
cold   : empty:105 vinegar:102 vinegar:103 apple-vinegar:103 apple-vinegar:105  -> 5 runs, 0 errors  (49.7s)
warm60 : empty:105 apple:100 apple:101 apple:104 vinegar:102 vinegar:104
         vinegar:105 apple-vinegar:102                                          -> 8 runs, 0 errors  (91.1s)
```
(`final-cold-13.json`, `final-warm-13.json`)

Two intermediate iterations were needed: `cold vinegar:103` advanced past tick 146 and exposed
first the tilted-support abort, then the departure abort. Both were fixed inside the same
acceptance contract; no separate mechanism was added.

Full 48-cell sweep as a regression check (`cold-full.json`, `warm-full.json`):

```
cold   : 24 runs, 0 errors, 255.5s      (baseline: 19 runs, 5 errors)
warm60 : 24 runs, 0 errors, 314.9s      (baseline: 16 runs, 8 errors)
```

**Every one of the 35 cells that completed on the baseline reproduces bit-identically** —
same escape count and same `completedTick` in all 35. The fix changes behaviour only on the
exact ticks that used to abort. Per-cell table in §7.

### Rejected requests, and time/reserve advance

Measured with a scratch atomic counter (removed before the final patch):

| Arm | motion requests | held on verified prefix | reverted to request start | budget recoveries |
|---|---|---|---|---|
| cold (24 cells) | 137,186 | 188 (0.14 %) | 0 | 0 |
| warm60 (24 cells) | 138,371 | 842 (0.61 %) | 0 | 3 |

The revert-to-request-start path never fired across 275 k campaign requests; it is the
safeguard behind `hold`, not the working path. The extra per-destination proof did not push
the query budget: 3 budget recoveries in 138 k warm requests, and cold has none.

Time and reserve advance through every hold. All 13 recovered cells reach a terminal state
for all 20 flies (`still-running 0`) and drain reserve:

```
cold   empty         105  tick 306  esc 1 starv 19  still-running 0
cold   vinegar       102  tick 312  esc 4 starv 16  still-running 0
cold   vinegar       103  tick 315  esc 2 starv 18  still-running 0
cold   apple-vinegar 103  tick 315  esc 1 starv 19  still-running 0
cold   apple-vinegar 105  tick 310  esc 3 starv 17  still-running 0
warm60 empty         105  tick 315  esc 1 starv 19  still-running 0
warm60 apple         100  tick 800  esc 3 starv 16  still-running 0
warm60 apple         101  tick 318  esc 0 starv 20  still-running 0
warm60 apple         104  tick 318  esc 2 starv 18  still-running 0
warm60 vinegar       102  tick 318  esc 2 starv 18  still-running 0
warm60 vinegar       104  tick 315  esc 4 starv 16  still-running 0
warm60 vinegar       105  tick 315  esc 4 starv 16  still-running 0
warm60 apple-vinegar 102  tick 314  esc 8 starv 12  still-running 0
```

At the tick level, the held fly of cold `vinegar` seed 103 (walking on shoe surface 26) is
captured across seven consecutive held ticks with reserve draining 9.84 → 9.56, i.e. the clock
and the metabolism keep running while contact refuses the request.

## 5. Remaining failures

**None.** All 48 cells of both arms complete with zero structural errors, and the whole
workspace test suite is green.

Two things are explicitly *not* claimed:

* The pre-existing microscopic interpolation-appearance finding is untouched and remains open.
  No new visual work, no screenshots, no visual certificates.
* The baseline pilot JSONs were produced before `acebdfd`; one of the 13, warm60 `vinegar`
  seed 102, failed there with `landing would jump to a different support root`, a message that
  no longer exists in the tree. That cell is green now, but its repair is `acebdfd`'s, not this
  change's.

The paired cold/warm60 comparison the pilot exists to run is unblocked: both arms complete all
24 cells, so root/CampaignClaude can run the final paired pilot.

## 6. Behavioural note for the game

A fly whose every proposed destination is blocked holds its pose for that tick. It is not
wedged: the mode owner still runs, reserve still drains, and the next tick issues a different
request — cold `vinegar` 103's fly departs the shoe two ticks later, and every recovered cell
reaches a terminal outcome. Previously that same situation killed the whole attempt.

## 7. Per-cell escape counts, baseline vs new

`BASELINE-FAILED` = the cell aborted with a structural error in the original pilot.

```
cold                                        warm60
apple         100   1 ->  1                 apple         100   FAILED ->  3
apple         101   0 ->  0                 apple         101   FAILED ->  0
apple         102   1 ->  1                 apple         102   2 ->  2
apple         103   0 ->  0                 apple         103   5 ->  5
apple         104   2 ->  2                 apple         104   FAILED ->  2
apple         105   2 ->  2                 apple         105   0 ->  0
apple-vinegar 100   2 ->  2                 apple-vinegar 100   2 ->  2
apple-vinegar 101   1 ->  1                 apple-vinegar 101   2 ->  2
apple-vinegar 102   5 ->  5                 apple-vinegar 102   FAILED ->  8
apple-vinegar 103   FAILED ->  1            apple-vinegar 103   7 ->  7
apple-vinegar 104   2 ->  2                 apple-vinegar 104   3 ->  3
apple-vinegar 105   FAILED ->  3            apple-vinegar 105   2 ->  2
empty         100   0 ->  0                 empty         100   2 ->  2
empty         101   1 ->  1                 empty         101   0 ->  0
empty         102   0 ->  0                 empty         102   1 ->  1
empty         103   1 ->  1                 empty         103   2 ->  2
empty         104   0 ->  0                 empty         104   2 ->  2
empty         105   FAILED ->  1            empty         105   FAILED ->  1
vinegar       100   2 ->  2                 vinegar       100   3 ->  3
vinegar       101   2 ->  2                 vinegar       101   3 ->  3
vinegar       102   FAILED ->  4            vinegar       102   FAILED ->  2
vinegar       103   FAILED ->  2            vinegar       103   4 ->  4
vinegar       104   3 ->  3                 vinegar       104   FAILED ->  4
vinegar       105   1 ->  1                 vinegar       105   FAILED ->  4
```

## 8. Artifacts

All under `/tmp/claude-contact-acceptance/`:

* `contact-acceptance.diff` — the full production + regression diff
* `repro-baseline.json`, `repro-capture.json` — baseline reproduction and captured states
* `cold-refail.json`, `cold-refail2.json`, `cold-refail3.json` — the three fix iterations
* `final-cold-13.json`, `final-warm-13.json` — the 13 previously-failed cells, clean core
* `cold-full.json`, `warm-full.json` — full 48-cell regression sweep
* `postfmt-check.json` — post-format sanity rerun of the focus cells
* `tagcap.json`, `surfaces.txt` — departure/support capture run and resolved surface map

Shared `data/` was read only. The scratch probe (`campaign_warmup_probe.rs`, cell selector,
rejection counters, state capture) and the `BRAIN_WARMUP_TICKS` experimental init are removed;
the final patch contains none of them.
