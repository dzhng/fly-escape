# Research and reproduction record

Inspected 2026-09-06. Planning evidence only: the browser game has not been built, the raw data is absent locally, and old Python timing/escape claims have not been reproduced in this session.

## Repository findings that change the plan

| Evidence owner | Finding | Consequence |
|---|---|---|
| `src/graph_loader.py`, `scripts/download_connectome.py`, `scripts/download-neurons.js` | Loader expects three short-named Feather files; JS downloads differently named significant-only data. Local data contains only a placeholder. | Slice 01 chooses one full-source offline pipeline, verifies hashes and reproducible extraction. No fake graph as release evidence. |
| `src/graph_loader.py::extract_visual_motor` | Approximate 70k target, minimum weight 5, seed-touching edges; MBON selection truncates an unordered set. | Preserve edge semantics, stabilize selection and record the intentional difference. Do not claim byte parity with nondeterministic selection. |
| `src/lif_sim.py::step` | Sparse incoming-current multiplication, per-neuron noise, voltage readouts, threshold/refractory ordering. | Match intermediate dynamics with injected noise before optimizing; one shared graph, independent fly states. |
| `src/feeding_maze_sim.py` | Timeout after any feeding returns success, and swarm consumers count that as escape. Exit sensory source is a broad Gaussian. | Slice 04 replaces result semantics; slice 03 gates exit cue by room/LOS/radius. |
| `src/landing_feeding.py` | Contact plus hunger can bypass proboscis activity; previously fed flies are exempted from starvation. | Ablation and finite-reserve tests are required, not optional cleanup. |
| `src/landing_feeding.py` | Light and shadow contribute identically to an AOTU input. | Opposing behavioral claims need mirrored probes before visual-cue puzzles. |
| `src/maze.py` vs `src/feeding_maze_sim.py` | Wind advection exists in one path while the feeding loop samples separate static Gaussians; wind also influences turning through a world-axis expression. | One field owner and explicit physical wind; eliminate divergent sampling. |
| `perf_audit.py` and historical reports | Old timings are not whole-browser throughput and may include terminal/no-op work; source data is currently unavailable. | Count active simulated ticks and full telemetry production. Measure 1/20/100 rather than linear extrapolation. |

Keeping 70,000 float voltages ×20 flies ×3,000 ticks ×4 bytes would require 16.8 GB before other state. This arithmetic motivates grouped summaries, not a reduced biological graph. The chosen record contract retains replay without full-neuron histories.

## Reference repository

Read `~/dev/game` at revision `90bbdcaa185001c75a30699a77747ef61ea849db`: root workspace, Rust crates, thin WASM exports, TypeScript web client and renderer workbench. Borrow pure Rust simulation, bulk data boundaries, asset iteration surfaces and common root commands. Do not copy unused campaign/contract crates, bespoke GPU renderer infrastructure, or the capped tick-dropping behavior in `web/src/shared/simClock.ts`; recorded neural playback must not skip ticks. The reference uses WASM views whose lifetime matters: memory growth and Worker transfer require explicit ownership here.

## Primary external sources

- [MaleCNS downloads](https://male-cns.janelia.org/download/) and [Janelia project](https://www.janelia.org/project-team/flyem/male-cns-connectome): source data identity, formats and attribution. Download page labels data CC-BY; verify the exact distribution terms and retain attribution with the prepared artifact. Dataset anatomy does not itself validate our behavioral mappings.
- [wasm-bindgen Worker example](https://rustwasm.github.io/docs/wasm-bindgen/examples/wasm-in-web-worker.html): reproduce a minimal Worker/WASM round trip before neural integration in slice 02. The throwaway exemplar is removed when the production Worker seam passes.
- [MDN transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects): transferring ArrayBuffers detaches them from the sender; typed arrays are views. Copy WASM results into owned transferable buffers instead of detaching shared linear memory.
- [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): background timing/rendering is throttled. Pause playback on hiding; do not use wall-clock catch-up to consume unseen simulation time.
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): current renderer requires WebGL2. Compile materials before playback where useful and dispose resources. This is adequate for the scene; GPU neural compute is not required.
- [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html): an available alternative, including WebGL2 fallback. Deferred because matching the reference repository does not require adopting its renderer complexity.
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) and [Raycaster](https://threejs.org/docs/pages/Raycaster.html): standard scene/animation ingestion and model picking. Use one production loader in the game and asset lab.
- [Khronos Blender glTF exporter](https://github.com/KhronosGroup/glTF-Blender-IO/blob/main/README.md) and [glTF overview](https://www.khronos.org/gltf/): author in Blender, export a runtime GLB, and reproduce round-trip/orientation before modeling detail. Do not treat a successful export as proof of correct scale or camera appearance.
- [ts-rs](https://docs.rs/ts-rs/latest/ts_rs/): derive TS wire types from Rust structs rather than maintain handwritten duplicates. Verify enum representation and binary offsets through consumer fixtures; deriving JSON types does not automatically define binary layout.

Pin compatible dependency versions during implementation and commit lockfiles. This research selects interfaces, not unverified version combinations.

## Scientific truth boundary

The source code is evidence of what the prototype computes, not proof of neuroscience claims in its comments. Slice 03 records pathway identity, sensory injection, output readout, mirrored response and ablation evidence. Tooltips cite structural dataset/anatomical references where supported, and separately identify our model choices. Any new strong biological claim needs primary literature review during that slice; unsupported claims are softened or omitted, never inferred solely from an appealing animation.

## Neuroscience explanation sources

Descriptions teach neuronal processes rather than puzzle rules. The shared introductory explanations use [Gerstner et al., Neuronal Dynamics §1.3](https://neuronaldynamics.epfl.ch/online/Ch1.S3.html) for leaky integration, spike thresholds, reset and refractory modeling, and [Purves et al., Excitatory and Inhibitory Postsynaptic Potentials](https://www.ncbi.nlm.nih.gov/books/NBK11117/) for excitation/inhibition. Circuit-specific anatomical claims still need their own source review in slice 13; group names inherited from the spike are insufficient evidence.
