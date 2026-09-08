# Timed-round WASM profile — where the 3000 ticks go

Diagnosis only. Nothing in the repository or in the root's built assets was modified; every
artifact produced here lives under `/tmp/timed-performance/`. `git status --porcelain` in
`/private/tmp/fly-timed-rounds` reports the same 23 entries before and after this work.

## Headline

One timed campaign round is **~92% neural** and, inside that, **~52% of the entire round is
Box–Muller noise generation** for 1.4M gaussian draws per tick. Field sampling, contact
geometry, body motion, record encoding and JSON transport together account for under 8%.

| Subsystem | Share of wall clock | Evidence |
| --- | --- | --- |
| Neural — Box–Muller noise draw (`Brain::step` noise loop + software libm trig) | **~52%** | profile + isolation bench |
| Neural — `advance()` synaptic CSR scan and group/motor readout | **~30%** | profile + isolation bench |
| Neural — membrane/spike update loop | **~9%** | isolation bench (silenced-neuron delta) |
| Contact/geometry (`sim::surface`, `Body::contacts`, parry3d shape casts) | **~4.9%** | profile buckets |
| Sensory cue currents (`sensory::group_currents` + its HashMap hashing) | **~2.5%** | profile, caller-attributed |
| Field advance (`FieldSet::advance`) | **~0.3%** | profile |
| Record encode (`take_chunk`) | **~0.02%** | 4.7 ms of 22,433 ms, timed directly |
| `serde_json` step/response marshalling | **<0.01%** | profile |

Measured cost: **44.87 ms per tick** for 20 flies → a 3000-tick round is **~135 s** of pure
compute, which lands inside the 111–145 s production window this task started from.

## What was built and run

Source: worktree `/private/tmp/fly-timed-rounds`, `git rev-parse HEAD` =
`3c2e3e24e153b9d1f65e4015be717e87b1b387a9` (branch `codex/timed-rounds`, 23 uncommitted entries).
Toolchain: `rustc 1.94.1`, `cargo 1.94.1`, `wasm-pack 0.15.0`, `wasm-opt version 117`
(wasm-pack's cached copy), `node v24.14.0`, darwin/arm64.

`wasm-pack build --profiling` alone does **not** keep the name section — wasm-opt strips it, and the
result is byte-comparable in size to the release build (3,336,713 vs 3,336,784 bytes, zero `sim::`
symbols). The named artifact therefore takes two steps:

```sh
# 1. profiling build, wasm-opt skipped so the name section survives
wasm-pack build crates/game-wasm --target web --profiling --no-opt \
  --out-dir /tmp/timed-performance/wasm-named

# 2. re-apply production-level optimization, keeping debug names
~/Library/Caches/.wasm-pack/wasm-opt-50385c9e73ccee70/bin/wasm-opt -O -g \
  /tmp/timed-performance/wasm-named/game_wasm_bg.wasm \
  -o /tmp/timed-performance/wasm-opt-named/game_wasm_bg.wasm

# 3. profile 500 ticks of the second campaign level
node /tmp/timed-performance/profile.mjs \
  /tmp/timed-performance/wasm-opt-named \
  /tmp/timed-performance/opt-named-500.cpuprofile 500
```

SHA-256:

| Artifact | SHA-256 |
| --- | --- |
| `/tmp/timed-performance/wasm-opt-named/game_wasm_bg.wasm` (named, `-O -g`, profiled) | `c0db60560dd14d9e30c48e5202f499a74eb47cee8f4af2d6bf928aa74ff960fc` |
| `/tmp/timed-performance/wasm-named/game_wasm_bg.wasm` (named, no wasm-opt) | `f6c6a1918f0a98537d600b66c459f67084e7d8286de8c905dcc697b9171f05bf` |
| `/tmp/timed-performance/bench-opt/sim_bench_wasm_bg.wasm` (out-of-repo isolation bench) | `bc0c7fa0e4d4fea1154b7af447c501cbb7f757d5116a0c493fb7a365811f2a16` |
| root production `packages/sim-client/src/wasm/game_wasm_bg.wasm` (read only, for comparison) | `48dcb33562fbe919d8757b5fff160206fe1ed49dbf452138539c4b17671956a1` |
| `data/processed/brain/graph.bin` | `6218f74521ca39652c59bd7524fb6aa5fe587058ce438a3fa08e4d8eee7cd454` |
| `apps/web/src/levels/turn-the-corner.ts` | `6f536b9cb55fb73edc65244943074d91cca4488c78a7a957ed69b70dabb66fed` |

Workload — the real level, the real session type, not a fixture: `AttemptSession` built from
`apps/web/src/levels/turn-the-corner.ts` (level `turn-the-corner`, the second campaign level;
`life.kind = "timed"`, `durationTicks: 3000`, cues `excitatoryOdor`/`inhibitoryOdor` at gain 2,
`tasteGain: 1`, 7 fixed objects, no zappers/food/sources), `rootSeed
11716541513791412824`, `flyCount 20`, no placements. 500 ticks stepped through
`AttemptSession.step()`, with `take_chunk()` drained at 10 buffered ticks exactly as the worker
does. At tick 500 the session reports `neuralSteps: 10000` — all 20 flies were still alive for
every tick, so no fly was silently costing nothing.

## Is the named artifact representative?

Yes. The same harness was run against the root's untouched production release wasm, and the two
agree to ~1% in wall clock and rank-for-rank in the profile:

| | named `-O -g` build | production release build |
| --- | --- | --- |
| 500 ticks wall | 22,433 ms (44.87 ms/tick) | 22,661 ms (45.32 ms/tick) |
| #1 self | `sim::lif::Brain::step` 63.92% | `wasm-function[576]` 64.34% |
| #2 self | `compiler_builtins…rem_pio2` 16.61% | `wasm-function[95]` 16.47% |
| #3 self | `compiler_builtins…cos` 6.63% | `wasm-function[249]` 6.76% |
| #4 self | `compiler_builtins…sin` 4.29% | `wasm-function[263]` 3.96% |

The production indices are reported only as a match check against this run's own profile of that
same file; they are not used to identify anything, and no native/pre-wasm-opt index was consulted.

## Attribution detail

Self-time buckets, `opt-named-500.cpuprofile`, 72,877 samples at a 200 µs sampling interval
(`node analyze.mjs opt-named-500.cpuprofile`):

```
 63.92 %  sim::lif::Brain::step            (noise loop + advance(), inlined together)
 27.67 %  compiler_builtins libm           rem_pio2 16.61 / cos 6.63 / sin 4.29
  4.85 %  contact/geometry                 parry3d support maps, ContactScene, Body::contacts
  2.65 %  other                            dominated by sensory cue-current hashing (below)
  0.40 %  field/sensory                    FieldSet::advance 0.29
  0.21 %  attempt glue                     Attempt::step itself
  0.13 %  alloc/memory
  0.01 %  body/motion
  0.00 %  serde-json
```

The libm samples are **not** geometry. Caller attribution
(`node callers.mjs opt-named-500.cpuprofile "rem_pio2|::cos::cos|::sin::sin"`) puts ~89% of them
directly under `sim::lif::Brain::step ← sim::attempt::Attempt::step`, with 4 of 29,978 samples
reaching trig from `sim::surface::support_rotation`. These are the `theta.cos()` / `theta.sin()`
calls in the Box–Muller pair loop; wasm has no hardware trig, so each call runs the software
`rem_pio2` reduction plus a polynomial kernel.

Likewise the hashing in `other` is sensory, not neural: 84% of `hashbrown`/`sip` samples are under
`sensory::group_currents ← sensory::cue_currents ← Attempt::step`, i.e. the per-fly, per-tick
`HashMap` used to assemble cue currents. Counting it with `field/sensory` puts the whole
field+sensory path at ~2.5–3%.

`Brain::step` cannot be split further by the sampler because `advance()` is inlined into it, so
the split was measured directly instead, using only sim's public API from an out-of-repo bench
crate (`/tmp/timed-performance/bench-crate`, `node bench.mjs 200`, per fly-tick, 70,000 neurons):

| Variant | ms per fly-tick | Reading |
| --- | --- | --- |
| `Brain::step()` — noise + advance | 1.861 | what the game runs |
| `Brain::step_with_noise()` — advance only | 0.800 | **noise draw = 57% of a neural tick** |
| `step_with_noise()`, all 70,000 neurons silenced | 0.620 | membrane/spike loop ≈ 22% of advance; CSR scan + readout ≈ 78% |

Cross-check: 1.861 ms × 20 flies = 37.2 ms/tick against 44.87 ms/tick measured end to end; the
remainder is the ~7 ms/tick of contact, sensory, field, record and glue the profile shows.

Per tick, at 20 flies / 70,000 neurons / 798,715 edges:

- 15.97M CSR edge visits (6.4 MB of `f64` weights streamed once **per fly**, i.e. 128 MB/tick)
- 1.4M membrane updates
- 700k Box–Muller pairs → 700k `ln`, 700k `sqrt`, 700k `cos`, 700k `sin`, 1.4M PRNG draws

## Next actions

Both are sized from measurements already taken; neither is applied here.

### 1. Share one argument reduction per Box–Muller pair (smallest, bit-exact)

`Brain::step` calls `theta.cos()` and `theta.sin()` on the *same* `theta`, so wasm runs `rem_pio2`
twice per pair — and `rem_pio2` alone is 16.6% of the whole round. `libm::sincos` reduces once and
evaluates both kernels.

Verified in `/tmp/timed-performance/bench-crate` (`node sincos.mjs`, 2M angles over `[0, 2π)`):
**worst bit difference = 0** between `(x.sin(), x.cos())` and `libm::sincos(x)`, at 47% less time
for the trig alone. Re-measured inside a faithful copy of the shipped noise loop
(`node noise.mjs`, 70,000 neurons × 200 iterations, two runs): 0.85 → 0.76 and 0.77 → 0.67 ms per
fly-tick, again bitwise identical output.

Expected: **~10–13% off the noise loop ≈ 5–7% of round wall clock, ~7–9 s off a 135 s round.**
Diff: add `libm` to `crates/sim/Cargo.toml`, replace two lines in `Brain::step`. It emits the same
numbers, so `PRNG_ID` (`splitmix64-box-muller-v1`), attempt spec hashes and every replay stay valid
— guard it with a test asserting bitwise-equal noise vectors for a fixed seed and let the existing
determinism tests confirm the rest. Modest, but it is the only sizeable win that costs nothing.

### 2. Get a decision on whether the noise *stream* may change — that is where the round actually is

Everything larger requires emitting different numbers, which invalidates recorded attempts, so it
is a product decision rather than a refactor, and it should be made before any further optimization
work is scheduled. The ceiling is already measured (`node alt.mjs`, same 70,000-neuron loop):

| Noise draw variant | ms per fly-tick | Round-level effect |
| --- | --- | --- |
| shipped Box–Muller with trig | 0.77–0.85 | baseline (~52% of the round) |
| same, one shared reduction (action 1) | 0.67–0.76 | bit-exact, −5–7% wall |
| Marsaglia polar, no trig at all | 0.35–0.43 | **−28% wall**, different stream |
| PRNG draw + store only (floor) | 0.04–0.13 | bound, not a proposal |

So the realistic split is: ~7 s available without changing anything observable, ~38 s available if
the noise stream may change (`PRNG_ID` bump + replay invalidation), and a further ~30% of the round
sitting in the per-fly CSR scan, where the only bit-exact restructuring — streaming the shared
6.4 MB weight array once per tick across all 20 flies instead of 20 times, which preserves each
fly's summation order — needs its own measurement before it is worth proposing. Brain fidelity is
untouched by all three.

## Scope and limits

- Node/V8, single-threaded, no Worker scheduling and no rendering; the browser's 84–98 s wait
  includes work this profile deliberately excludes.
- 500 of 3000 ticks, extrapolated linearly. Per-tick cost is stable here because all 20 flies stay
  alive; a round where flies end early would shift the mix toward the non-neural remainder.
- Sampling profiler at 200 µs: shares below ~0.1% are indicative only.
- The `Brain::step` internal split (noise / scan / membrane) comes from the isolation bench, not
  from the sampler, and the silenced-neuron variant also suppresses spiking, so the
  "CSR scan ≈ 78% of advance" figure is an approximation of the scan's share, not an exact one.
- Run-to-run jitter on the bench loops is ~10%; ranges above are reported, not single runs.

## Files

```
/tmp/timed-performance/
  report.md                  this file
  profile.mjs                500-tick AttemptSession profiler (level 2, seed 11716541513791412824)
  analyze.mjs                self-time by function and by subsystem bucket
  callers.mjs                caller attribution for a function-name regex
  bench.mjs  sincos.mjs  noise.mjs  alt.mjs      isolation benches
  bench-crate/               out-of-repo crate, sim public API only (path dep on the worktree)
  wasm-named/ wasm-opt-named/ bench-named/ bench-opt/    built artifacts
  opt-named-500.cpuprofile   named profile           run-opt-named.txt
  prod-500.cpuprofile        production comparison   run-prod.txt
  build.log build-named.log bench-build*.log
```
