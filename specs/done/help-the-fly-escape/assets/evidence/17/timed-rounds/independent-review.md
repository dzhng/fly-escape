# Independent review — timed rounds / LifeModel migration

Candidate: `/tmp/timed-rounds-root-review.patch` (27 files) against `/Users/david/dev/fly-escape`
(working tree already has it applied; reviewed against the live tree).
Scope: correctness of the LifeModel split and stale runtime consumers. No art, no deferred
feeding work. Nothing was edited; no tests or browsers were run.

## Verdict

The core migration is correct. `Body::new` validation is preserved exactly (`initial` is still
checked finite/non-negative and `<= capacity`; the zero-cost/zero-capacity rejections moved into
`ReserveModel` unchanged), the cost table reproduces the old per-mode arms including the
`Landing → flying_cost` and `Feeding → idle_cost` cases, and every energy write is now behind
`if let Some(model)` so a timed body never touches `state.reserve`. No stale `initialReserve` /
`reserveCapacity` identifier survives anywhere in the repo. The `campaign_probe` TS-slicing helper
does work: I parsed both level modules with the same `find("= {")+2 .. rfind("};")+1` slice and got
valid JSON, 5 and 6 rooms — matching the test's name. Dropping the `roomLinks == rooms - 1`
assertion is justified: both authored houses contain adjacency cycles (open-window links 1-2, 1-3
and 2-3), so the old tree-shape claim is false for them.

Seven actionable items below, ranked.

---

## 1. `BodyConfig::default()` still defaults to the deferred starvation model — CONFIRMED

`crates/sim/src/body.rs:127-137`

The crate default is `LifeModel::Reserve { initial: 20, capacity: 20, idle_cost: 0.2, ... }`. Both
production fixtures had to *remember* to opt out: `swarm_lab.rs:92` and `setup_fixture.rs:43` each
write `life: LifeModel::Timed` explicitly.

Failure scenario: someone authors the third level or a new lab fixture in Rust with
`BodyConfig { walk_speed: 0.12, ..Default::default() }`. There is no compile error and no
validation error — they get a reserve of 20 draining at 0.2/s idle, so every fly starves at ~100
game seconds, one third of the way into the new 300-second horizon, and the round reports
`starved: 20` instead of `timedOut: 20`. The product decision is timed rounds with starvation
deferred; the crate default should be `LifeModel::Timed`, with `impl Default for ReserveModel`
supplying the finite-life diagnostic numbers.

## 2. The "default is Reserve" assumption is re-checked at runtime in five places — CONFIRMED

- `crates/sim/examples/feeding_probe.rs:121-129` — `..BodyConfig::default().life.reserve().ok_or("feeding evidence requires the finite-life model")?`
- `crates/sim/tests/body.rs:78-82` — `.expect("the default body carries the finite-life model")`
- `crates/sim/tests/body.rs:355`, `crates/sim/tests/body.rs:746`, `crates/sim/tests/record.rs:229` — `.unwrap()`

These guard a condition no caller can produce: it is a property of this crate's own `Default` impl,
not of any input. Two concrete consequences. (a) They make item 1 un-fixable without touching five
files, and they turn what should be a compile error into a runtime panic in three tests plus a probe
that aborts with a misleading operator-facing message about "feeding evidence" when the real cause
is an unrelated default flip. (b) `feeding_probe.rs` pays for it with a seven-line nested
struct-update expression where the old code was `BodyConfig::default()` plus a `5.` argument.

`impl Default for ReserveModel` collapses all five to
`LifeModel::Reserve(ReserveModel { initial, ..Default::default() })` — no `Option`, no unwrap, no
error string. Pairs with item 1: do them together.

## 3. `campaign_probe` still reports starvation summaries that are structurally zero — CONFIRMED

`crates/sim/examples/campaign_probe.rs:504-519`, and `:248`

`starved`, `medianStarved` and `medianStarvationIncreaseOverReference` existed only to feed the
`foodEnergyPassed` gate this patch deletes. With `life: timed`, `outcomes.starved` is 0 for every
seed in every arm and `body.reserve` is 0.0 at every event, so:

- every future acceptance report carries `"medianStarved": 0` and
  `"medianStarvationIncreaseOverReference": 0`
- `:248` writes a `"reserve": 0` column into every one of the per-event diagnostic rows

Failure scenario: someone reads a fresh 30-seed report, sees `"medianStarved": 0`, and concludes
starvation was measured and did not occur — when in fact it is not modeled at all. That is exactly
the confusion the timed-round switch was meant to remove. Delete the three summary fields and the
per-event `reserve`. Related dead fixture data: `:573` still passes `"medianStarved":1` into
`acceptance()`, which no longer reads it.

## 4. Deleting `assets/levels/OpenWindow.json` leaves the probe with no runnable input — CONFIRMED

`assets/levels/OpenWindow.json` (deleted); `crates/sim/examples/campaign_probe.rs:9-17`;
`specs/help-the-fly-escape/README.md:17`

The deletion itself is right — `open-window.ts` is the source of truth and the tests now read it.
But `campaign_probe`'s `Content` needs `reference`, `poor`, `tuningSeeds`, `heldoutSeeds` and
`frozen` alongside `level`/`tuning`, and the authored TS modules carry only `level` and `tuning`.
Every remaining `Content`-shaped JSON in the repo is historical evidence under
`specs/help-the-fly-escape/assets/evidence/`. I checked `evidence/16/prepared/candidate.json`: its
`bodyConfig` has no `life` key and its level still has `initialReserve`, so `Content`
deserialization now fails on the required `bodyConfig.life`.

Failure scenario: the next person follows README:17 ("run fresh-seed reference/poor-placement
gates"), runs `cargo run --example campaign_probe <graph> <any content JSON in the repo> tuning 30
out.json`, and gets a serde "missing field `life`" error for every candidate — with no in-repo file
that can work. Either author the replacement Content input for the two houses, or state in the spec
that one must be authored before that gate can run.

## 5. Two different things are both named `reserve` inside `Body::step` — CONFIRMED (naming)

`crates/sim/src/body.rs:552`

`let reserve = self.config.life.reserve();` is an `Option<ReserveModel>`, while `self.state.reserve`
is the `f64` energy. They meet in one expression at `:553` (`reserve.is_some() && self.state.reserve
<= 0.`) and again at `:757`. Behavior is correct, but a reader — or the next edit — naturally reads
`reserve.is_some()` as "has energy left" rather than "this body has an energy model at all". Rename
the local to `energy` or `model` (the code already calls it `model` inside every `if let`).

## 6. `playback.tsx` hides only the `starved` chip, so the counter row is inconsistent — CONFIRMED

`apps/web/src/playback.tsx:526`

`counts` is initialized with all five outcomes at zero and every entry renders, so a campaign round
already shows "0 zapped" and "0 caught" permanently — both authored levels have `"zappers": []` and
no hazard until the player places one. Filtering `name !== "starved"` special-cases one impossible
outcome by string literal while leaving the other impossible ones visible, and duplicates in the
view a decision `LifeModel` already owns.

Failure scenario: a player on Open Window sees "20 active · 0 escaped · 0 zapped · 0 caught · 0
timed out" and can't tell which of those the level can actually produce. Either derive the shown set
from what the resolved level can produce (life model, zappers, placed contact hazards), or show all
five and drop the filter. As written the special case reads like a leftover from the migration.

## 7. `about.tsx` dropped the feeding/energy disclaimer while the lifecycle lab still models it — PLAUSIBLE

`apps/web/src/about.tsx:50-52`

"Sensory gains, movement decoding, feeding and energy reserves and collisions are simplified game
models" became "Sensory gains, movement decoding, and collisions are simplified game models". That
section ("What the simulation adds") is app-wide — the paragraph two below it describes the activity
panels, i.e. the labs. `/lab/lifecycle` still runs `LifeModel::Reserve`, still renders "Remaining
reserve" and a reserve progress bar (`lifecycle.tsx:179-188`), and still emits feeding events. The
campaign stopped using the mechanism; the mechanism did not stop being user-reachable, so the
scientific-accuracy disclaimer lost a subject it still has. Marked PLAUSIBLE because it depends on
whether the About page is meant to describe the labs — but the reflow was also not applied, leaving
an orphaned line break mid-sentence, which suggests the edit was mechanical.

---

## Lower-value notes (no action required this pass)

- **`crates/sim/examples/campaign_probe.rs:560-568`** — the Rust test now parses TypeScript by
  string slicing. It works today and there is no prettier/formatter config in the repo, so the
  format is stable; but the level modules are now a Rust build input with an unstated contract
  (quoted keys, no trailing commas, no comments, exactly one trailing `};`). The comment explaining
  this lives in the Rust test, where nobody editing the TS will read it. A one-line comment at the
  top of `open-window.ts` / `turn-the-corner.ts` would put it where the break would be caused.
  Note that prettier's default `quoteProps: "as-needed"` would unquote every key and break the
  parse — worth knowing before anyone adds a formatter.
- **`packages/sim-client/src/record.ts:128`, `:539`** — `reserve` remains a fixed-width channel in
  record schema v4. In a campaign attempt it is now 3000 ticks × 20 flies of constant zero in the
  preallocated archive, and the `b.reserve >= 0` check at `:105` is vacuous. Removing it needs a
  schema bump, so probably not now — but it is worth naming while sizing memory for the 3.75×
  longer round.
- **`crates/sim/src/body.rs`** — `feeding_ready` is never updated on the timed path (correctly, it
  is only read inside the reserve branch). Dead state under the production model; harmless.
- `tests/browser/feeding-benefit.mjs` was updated correctly: it drives the *lifecycle* fixture,
  which is still `Reserve`, so `{...life, feedingRate}` and `life.initial` both resolve. It would
  silently no-op against a timed level (serde ignores extra fields on an internally-tagged unit
  variant, and `life.initial` would be `undefined` → `NaN` gain), but nothing points it at one.
- `swarm_lab.rs:91` comment "the closed room is what prevents an early escape" checks out: room 1
  spans x 7..8 and room 0 spans x -6..6, so the exit room is genuinely disconnected.
- The patch as handed over is a subset of root's tree: `tests/browser/retry-resources.mjs` (which
  adds the `round-time` and `outcome-starved` assertions covering the new UI) is modified in root
  but absent from the patch file. Reviewed from the tree, not the patch, so it is covered — but the
  patch alone would land the UI without its test.
