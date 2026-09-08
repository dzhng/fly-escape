# Motion preparation

Prepared on 2026-09-07; **slice acceptance remains open**, dependent on 05/06/07, final fresh visual critique and the nonblocking human checkpoint.

The target is a recognizable walking, flying, landing and feeding pose while retaining the authored fly silhouette. Same-camera stills compare motion against the static model; the renderer uses recorded mode changes and the single playback cursor, so no new simulation behavior is inferred from visual movement.

## Evidence

- `browser/`: full workbench stills at 0.05/0.3 seconds for static and all four clips, clip recording, and browser report. Earlier 0.125/0.375 static/walk captures are retained as probe context; those walking phases were nearly symmetric, so they could not establish visible motion. Every final clip passes pixel-exact reverse-seek and pause checks. A running Fly clip also freezes exactly after Pause.
- `crops/`: two-times close-fly crops for every captured workbench state and a complete contact sheet.
- `comparison/`: same-camera static versus each clip at 0.3 seconds, crop-level pixel and edge telemetry. Differences are real; the static silhouette remains intact. Flying has the largest expected change because its recorded mode adds presentation height; feeding is intentionally subtler.
- `playback/`: existing real-Worker playback suite passes pause, seek, speed, replay, restart and synchronized neuron readout with motion enabled.
- `playback-motion/`: actual playback canvas is pixel-identical when paused and after reverse seek to the same fractional cursor; different cursors render different scenes.

Client and renderer tests pass. The archive regression was observed red before implementation. Disabling mixer updates made the real-asset phase test fail, then restoring sampling passed. The asset test compares actual skinned vertices, verifies exact phase restoration and checks 100 seconds of looping cannot accumulate root motion. Typecheck passes against unchanged generated WASM artifacts.

## Ownership and review

The archive retains only four u16 values per fly (at most 800 bytes), using the existing record metadata allowance. Forward motion consumes only new packed ticks; reverse seeks rebuild through at most the authored 6000 ticks without decoded history. Mixers retain independent per-instance skeletal state and share asset geometry/materials. Unchanged sample time skips mixer work. Replacement/disposal releases mixer bindings before disposing shared resources. The workbench alone owns its explicit preview cursor; gameplay receives time exclusively from playback.

Shape review keeps transition decoding in sim-client and clip policy/mixer ownership in game-renderer, with four integration lines in playback. No new Rust types, archive buffers, dependencies, performance claims or animation-driven movement. Diff review resolved a repeated per-frame chunk scan and avoided whole-file formatting churn. Docs link from the slice and workbench. Fresh visual and human review remain for integration; this preparation does not claim visual acceptance.
