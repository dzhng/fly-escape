# Evidence and reference boundaries

Researched 2026-09-09. Repository baseline: `88813fe5c552e42269ba63858fe0e0057fbfcb43` (`origin/main` when inspected). These are source observations, not results from running the new sensor.

## The requested example

User reference: [Daniel Tan's paired-eye demo](https://x.com/DanielCHTan97/status/2097302341439345036?s=20). The post links [fly-api](https://github.com/dtch1997/fly-api); the inspected revision is `a6ad07a810b1a43cd0356149c07b32105eb46d2a`.

- [Demo driver](https://github.com/dtch1997/fly-api/blob/a6ad07a810b1a43cd0356149c07b32105eb46d2a/demo/track_b_embodied.py): enables FlyGym vision, runs a moving-target example, saves retina insets. The demo's decision interval is 0.05 seconds.
- [Visual controller](https://github.com/dtch1997/fly-api/blob/a6ad07a810b1a43cd0356149c07b32105eb46d2a/demo/svt_taxis.py): thresholds dark retinal samples, computes their centroid and area, then applies a hand-written ipsilateral speed rule. This visual pursuit is not evidence that camera images traverse its spiking connectome.
- [Method](https://github.com/dtch1997/fly-api/blob/a6ad07a810b1a43cd0356149c07b32105eb46d2a/docs/demo-report.md) and [prior art](https://github.com/dtch1997/fly-api/blob/a6ad07a810b1a43cd0356149c07b32105eb46d2a/docs/prior-art.md) explicitly separate the embodied visual example from the taste/connectome experiment. FlyGym supplies the original eye simulator and controller.
- [FlyGym 1.2.1 eye capture](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/fly.py): `_update_vision` renders `LEye_cam` and `REye_cam`, applies `Retina.correct_fisheye`, and calls `raw_image_to_hex_pxls`.
- [Retina transformation](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/vision/retina.py): resamples rectilinear camera images and pools into a hexagonal ommatidial layout. `hex_pxls_to_human_readable` displays sampled values. Its color approximation is not a calibrated photoreceptor model.

The example uses 721 samples per eye. That count, its color channels and its 20 Hz controller are reference settings, not our required settings. We borrow the inspectable optical pipeline, not its steering rule or a claim of biological fidelity. The first slice must reproduce the optics before translating it. Reference captures are not yet archived here; slice 01 owns obtaining permitted screenshots and their provenance. External video links are references, not locally verified reproduction evidence.

The fly-api repository identifies MIT licensing and vendored FlyGym code as Apache-2.0. Before copying code or asset data, inspect the pinned file's license and retain its attribution. A source's repository license is not an assumption about third-party model assets. Native FlyGym/MuJoCo dependencies belong only to the reference experiment; the browser product does not adopt them.

## What exists in this repo

Read these paths at the baseline above (`git show <baseline>:<path>`), not the older local `main` checkout:

| Owner | Verified current behavior | Consequence |
| --- | --- | --- |
| `crates/sim/src/attempt.rs`: `GAME_TICK_SECONDS`, `Attempt::advance_tick` | 0.1 s ticks; fields, pre-neural sensory sample, external currents, brain, then body | Camera input must be available before the corresponding brain update. |
| `crates/sim/src/body.rs`: `BodyPose`, `BodyState` | `BodyPose` has floor position and heading; height and quaternion belong to `BodyState` | Existing `input_pose` is insufficient for eye capture on fruit or in flight. Freeze complete pre-neural state. |
| `crates/sim/src/environment/fields.rs` | Eight horizontal light bins and blocked-light diagnostics | No current image, vertical retina or material sampling. |
| `scripts/connectome/vision_map.py`, `crates/sim/src/sensory.rs` | Annotation-derived overlapping weights map brightness to retained Tm2 neurons | Replace this input representation; preserve the brain and movement decoder. |
| `crates/game-wasm/src/attempt_session.rs` | Synchronous bounded stepping and native-owned packed chunks | Add a bounded request/commit seam, not a second simulation loop. |
| `packages/sim-client/src/attempt-worker.ts`: `pump` | Credit-controlled chunks, yielding after ticks, attempt/generation cancellation | Waiting for capture must not defeat cancellation or add an unbounded queue. |
| `packages/game-renderer/src/index.ts`: `WorldView` | `THREE.WebGLRenderer`, presentation-time pose, camera-dependent cutaways | Existing rendering is WebGL2, not WebGPU. Never capture the mutable player's view. |
| `packages/game-renderer/src/house.ts`, `apps/web/src/world-assets.ts`, `packages/sim-client/src/house-lighting.ts` | Authored mesh loaders and shared emitter definitions already exist | Extract shared scene construction; do not invent a second authored room or duplicate light positions. |
| `crates/sim/src/record.rs`, `packages/sim-client/src/record.ts` | Schema 5, 10-tick chunks, 128 MiB archive cap, native-exported offsets | Canonical eye bytes must fit the same archive and transfer accounting. |
| `apps/web/src/science-panel.tsx` | Selected-fly brain and sensory/neural traces | Add paired eyes here; update obsolete eight-direction explanation. |
| `apps/asset-lab` | Existing asset workbenches | Use an explicit `/retina` route as the new review surface. |

The retained graph has 366 audited Tm2 cells, 128 left and 238 right; it omits retinal R1–R8 cells and is a selected connectivity graph, not a full induced visual circuit. The current map's horizontal registration is a modeling assumption. Prior experiments establish downstream responses and input-silencing controls, but not reliable visual approach, avoidance or improved escape rates. See baseline `specs/done/neural-vision/README.md`, its `assets/input-map/README.md`, and `specs/done/campaign-vision/README.md`.

## Primary sources for the uncertain pieces

- [MaleCNS column documentation](https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/help.html#population-spatial-coverage) describes optic-lobe column coordinates, not calibrated world azimuth/elevation. A two-dimensional registration remains a model unless additional calibration is established.
- [Three WebGLRenderer API](https://threejs.org/docs/pages/WebGLRenderer.html) supports offscreen render targets and asynchronous readback. Verify the pinned r185 implementation and actual target browser; existence of an API does not prove low latency or worker compatibility.
- [Flyvis](https://github.com/TuragaLab/flyvis/tree/92b3845cc426dd309a1a0e1b3890156c42e14021) and its [Nature paper](https://doi.org/10.1038/s41586-024-07939-3) describe a trained, connectome-constrained visual-system model. They are a research alternative for future early-vision modeling, not a drop-in mapping from pixels to this MaleCNS graph. No new trained network is included in this feature.

## Memory arithmetic before choosing quality

For 16 flies and 6,000 sensory ticks (600 simulated seconds):

| Recorded signal | Bytes, before metadata and existing archive |
| --- | ---: |
| 721 uint8 samples × 2 eyes × every tick | 138,432,000 |
| 32 × 32 uint8 raw pixels × 2 eyes × every tick | 196,608,000 |
| 127 uint8 monochrome compound samples × 2 eyes × every tick (rejected final format) | 24,384,000 |
| 61 RGB8 compound samples × 2 eyes × every tick | 35,136,000 |
| 127 RGB8 compound samples × 2 eyes × every tick | 73,152,000 |

Thus low capture resolution alone is insufficient. The early grayscale candidate was rejected by the user. The revised initial candidate is 32×32 RGB acquisition, 61 compound samples per eye retaining RGB8, at the existing 10 Hz simulation boundary: 35,136,000 bytes over the same horizon. Quantize before neural consumption and archive those exact bytes. The complete memory formula must also include the new pose/metadata and existing movement/neural/event storage. These are planning calculations, not measured acceptance results.

## Color requirement and primary evidence

The user explicitly rejected grayscale for the final version and expects color to influence reactions. This changes both the byte budget and neural-model scope. Color capture alone is insufficient: the existing Tm2 brightness map would discard chromatic differences. Add a color-model research gate, freeze its approximation before tests, and require downstream discrimination of different colors with matched brightness. Motor preference magnitude remains an unproved outcome.

- [Sharkey et al., spectral sensitivity measurements](https://www.nature.com/articles/s41598-020-74742-1): photoreceptor responses depend on wavelength and ocular filtering; UV-sensitive R7 and blue/green-sensitive R8 are not equivalent to human RGB channels. Ordinary RGB artwork does not specify a UV spectrum.
- [Matsliah et al., visual-system wiring inventory](https://www.nature.com/articles/s41586-024-07981-1): canonical Tm5a/b/c and Tm20 have color-related input circuitry; subtypes differ. This identifies candidate evidence to audit, not ready-made RGB weights for every neuron of those types.
- [MaleCNS visual inventory](https://www.nature.com/articles/s41586-025-08746-0): use source-consistent labels/connectivity when deciding which candidate cells survive our retained graph. Do not transfer FlyWire body IDs into MaleCNS.
- [Hue selectivity study](https://www.janelia.org/publication/hue-selectivity-from-recurrent-circuitry-in-drosophila): hue-selective responses depend on recurrent circuitry. A label or a changed injected cell is not evidence of downstream chromatic processing.

The final adapter can be an explicit source-informed approximation over RGB, with its unsupported spectral dimensions stated. It cannot be sold as calibrated fly color vision. If no defensible mapping can be formed from retained cells, report that specific failure and reslice the neural part rather than ship color pictures over brightness-only neural input.

### Retained candidate inventory verified during planning

[The planning inventory](assets/planning-inventory.json) was reproduced by joining `data/raw/body-annotations.feather` to the integrated manifest's `bodyIds`, after verifying its SHA-256 against the manifest source. This is an actual read-only planning check, not execution of slice 04's broader spectral/eligibility audit.

| Exact annotation type | Retained L | Retained R |
| --- | ---: | ---: |
| Tm2 | 128 | 238 |
| Tm20 | 287 | 526 |
| Tm5a | 26 | 53 |
| Tm5b | 108 | 224 |
| Tm5c | 28 | 42 |

Exact labels Tm5d/e/f and R7/R8 had zero selected entries; aliases/subtypes still require the slice-04 inventory check. The historical Tm20 spatial audit rejects three left cells for missing columns, so retained count is not eligible spatial count. Counts establish candidates to investigate, not hue selectivity, subtype identity or a valid color adapter. The graph and annotation hashes are retained in the JSON; no dataset bytes were copied or modified.
