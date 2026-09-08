Done. Committed as `bca3e40` on `codex/sparse-neural-delivery`.

## What changed

`Graph::from_bytes` validates the on-disk incoming CSR exactly as before, then transposes it once into outgoing adjacency (`source_offsets` / `targets` / `weights`). `Brain::advance` clears `synaptic_input`, walks sources ascending, and delivers only from sources that spiked. The old incoming arrays are gone — one runtime matrix owner, no duplicate.

**Why values are identical, not close:** the file's row columns are validated sorted-ascending, so visiting sources ascending reaches each target in the same ascending-source order its incoming row held. Every postsynaptic sum is the identical sequence of f64 additions starting from 0.0. Scaling and target silencing then run in the same order as before, still ahead of any voltage change.

## Results

**Equivalence** — 500 ticks on the real 70k-neuron / 798,715-edge graph, seeded, with a scattered silenced set and time-varying external currents, hashing `voltage`, `spikes`, `refractory`, `synaptic_input`, `dv`, `can_spike`, motor and group readouts by raw f64 bits:

```
baseline (8ae56ea)  251308f828034385c41b1e567320723738f3ee714d4b49f08a3394566be6a837
candidate           251308f828034385c41b1e567320723738f3ee714d4b49f08a3394566be6a837
```

**Performance** — `attempt_probe data/processed/brain 20 2501` (50,020 fly ticks), baseline and candidate binaries run serially from the same release build:

| | baseline | candidate |
|---|---|---|
| wall seconds | 87.57 | **43.47** (2.01×) |
| neural steps/s | 571.2 | 1150.6 |
| step latency p50 / p95 / p99 (ms) | 34.8 / 38.9 / 40.9 | 17.0 / 19.6 / 23.0 |
| graph load / construct (s) | 0.0287 / 0.0061 | 0.0287 / 0.0056 |
| `storage_bytes` | 9,864,584 | 9,864,584 |
| RSS after stepping (KiB) | 108,720 | 109,984 |
| mode observations | identical (flying 21914 / landing 9488 / walking 18618) | |

`Brain::step` alone: 543–611 → 1107–1201 ticks/s across alternating runs.

**Tests** — 146 pass, 0 fail, including the Python numerical reference fixture and the silencing test, both unchanged. Added `spiking_sources_deliver_exactly_what_an_incoming_scan_accumulates`: a 9-neuron graph with unreciprocated edges, disjoint fan-in/fan-out, two targets each taking a cancelling `±1e16` pair astride a small weight, a silenced source carrying `1e300`, and a silenced target — asserted bit-exact against an independent incoming-row accumulation for 24 ticks of controlled noise. Mutation-checked: reversing the source order fails it (`0.5 is not the bit-exact incoming sum 0`), dropping the clear fails it; the existing fixture test catches neither.

## Choices and limitations

- **Memory.** My first transpose materialized the incoming weights alongside the transposed ones, which cost a ~9.2 MB RSS bump the allocator never returned — bad for a WASM linear heap. Weights now stream from the file directly into their transposed slot, cutting the residual to +736 KiB (measured at +1264 KiB in the final run). The remaining ~3 MB load-time peak is `columns` and `targets` coexisting during the transpose; permanent arrays are byte-identical to before.
- **One honest wart:** candidate `stepCallLatencyMs.max` was 53.9 ms vs baseline 42.6 ms in the final run — a single outlier (an earlier run measured 23.7 ms vs 50.4 ms). p50/p95/p99 all roughly halve consistently.
- `SIM_BUILD_ID` changes because `src/` changed, so records tagged with the old ID carry a different build id. Nothing in `sim` gates on it, and re-simulation is bit-identical, but flagging it.
- I amended one sentence in `specs/help-the-fly-escape/CONTRACTS.md` to say the postsynaptic-rows orientation is the *artifact's* contract and the loader may re-orient in memory only where every sum keeps its addition order. Revert that if you'd rather the contract stay literal.
- No browser or WASM runtime check — `cargo build --release -p game-wasm --target wasm32-unknown-unknown` compiles, and the rest is yours. The JS/TS suite was not run.
- The trace harness was a temporary `crates/sim/examples/neural_trace.rs`, now removed; its source and all run JSON are under `/tmp/sparse-neural-delivery/`. `data/processed` was only read.
