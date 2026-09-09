# Paired producer baseline and capture-only control

This harness compares the original worker at `88813fe5c552e42269ba63858fe0e0057fbfcb43` with the current production worker. Both receive the same campaign 0/1 level, tuning, empty placements, seed 42 and 16 flies. Only the diagnostic duration changes to 6000 ticks; authored campaign files stay untouched. A run may finish earlier if the original rules make every fly terminal, and the report preserves that actual work count.

The current native placement resolver supplies the optical scene definition before any timed worker production. This untimed lookup allocates no Brain and is reported as `opticalDefinitionPreparationMs`; it avoids re-creating fixed-placement rules in the harness.

The middle run uses the original worker and original WASM again. A test-only source patch awaits the current `RetinaCapture` immediately before each original `core.step()`. The captured RGB is discarded; it never reaches a neuron, body, field or score. The patch exists only in the temporary build directory, outside production sources. The original worker's only other substitutions are its pinned WASM import and baseline graph/manifest URLs.

The first run supplies a bounded pose tape. Initial native body transforms supply tick 1; each recorded output transform supplies the next tick's input. Each pose keeps world X/height/Z and the complete quaternion, in ascending fly-ID order. A 16-bit active mask excludes bodies already terminal before that tick. Sixteen flies and 6000 ticks require exactly 5,388,000 tape bytes. Each original packed chunk is hashed before being discarded; no complete record archive is copied or retained. One acknowledged chunk is in flight. The tape transfers once into the capture-only worker and is released when that worker terminates.

Every original packed header and each values, states, events, motion offsets/values/states and neural-step buffer must have the same SHA-256 in both baseline runs. Initial bodies, neural work and final outcomes must also match. A difference is a failed control, not a changed scientific result. The final retinal worker is expected to change neural inputs and possibly trajectories; its unchanged request, level/tuning/graph identities and matching physical capture-scene identity are checked separately.

## Reproduce

From the repository root, build the standalone production bundle:

```sh
bun tests/browser/retinal-baseline-build.mjs
bunx tsc -p tests/browser/retinal-baseline-tsconfig.json
bun test tests/browser/retinal-baseline-record.test.ts
bun tests/browser/retinal-baseline-run.mjs --smoke
```

The builder creates or verifies a clean detached baseline checkout, installs frozen dependencies, and builds each revision's WASM from its own source. It emits a standalone site and `build-identity.json` with source, graph, manifest, WASM, patch, toolchain and every bundled-file hash. It never imports native exports from a tree-shaken production site. Defaults use separate `/tmp/fly-retinal-baseline-*` paths and preserve the original `/tmp/fly-retina-baseline-site` artifact.

The smoke run uses three ticks per campaign and is correctness evidence only. It is allowed during concurrent neural experiments and must not be cited as performance evidence. Full runs remain on hold until the coordinator clears the CPU window:

```sh
bun tests/browser/retinal-baseline-run.mjs --full
```

The runner rechecks every bundled artifact against the build identity, serves its own local static origin, checks a hardware GPU, and writes both campaign reports plus the build identity. `RETINAL_BASELINE_CORE`, `RETINAL_BASELINE_BUILD` and `RETINAL_BASELINE_SITE` select build paths; `RETINAL_BASELINE_OUTPUT` selects the report directory. No environment option changes neural parameters, spawn seed or fly count.

## Timing boundaries

`producerMs` sums the existing worker's production metric. It covers core stepping, per-tick message yields, packing and—only in the control or final run—capture work. It excludes main-thread receipt, SHA-256 validation, tape extraction and credit acknowledgement. `observerMs` reports that main-thread work separately. `wallMs` includes worker setup and observer waits; `loadMs` remains the worker's native startup metric. Capture-only optical-world setup is separately reported as `initializationMs`.

`captureAwaitMs` covers awaited acquisition after pose-list construction. The added producer time also includes the small pose-tape reader and control hook; it is not a GPU-only measurement. All capture calls perform the real render, pooling, asynchronous readback and RGB validation. No diagnostic camera-image readback runs.

The order is baseline, capture-only, final. Each uses a fresh worker; browser/driver caches may remain warm between runs. This single ordered comparison does not estimate measurement uncertainty. Run repetitions only in the cleared CPU window if a threshold needs uncertainty bounds. Report both total producer time and time per active neural step: changed retinal behavior can change the final worker's total active work. These producer measurements do not replace the separately owned full-UI frame-time, archive-memory or retry gates.
