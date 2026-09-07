# Physical-scale reproduction: frozen adapter fails

The measured fly has a 3 mm body. Its authored antenna tips are only 0.404145 mm apart, while the current field adapter samples points 300 mm apart. The current 80 mm collision radius is 30.4 times the provisional 2.631336 mm envelope. These authored/model dimensions are not new biological measurements.

| Quantity | Current model | Measured/proposed diagnostic |
|---|---:|---:|
| Body length | renderer target | 3 mm |
| Collision radius | 80 mm | 2.631336 mm, provisional |
| Antenna lateral half-span | 150 mm | 0.20207253 mm |
| Antenna forward offset from body origin | 0 | 1.41450788 mm |
| Antenna height above floor | planar field ignores height | 1.48489003 mm |
| Field cell width | 250 mm | unchanged |
| Field diffusion / decay | 0.2 m²/s / 0.1 per s | unchanged |
| Ground-motion coefficient in this fixture | 120 mm/s | unchanged |
| Setup walk / flight coefficients | 120 / 240 mm/s | unchanged |
| Open Window walk / flight coefficients | 200 / 400 mm/s | unchanged |

Current tool sizes are also model choices awaiting the food/room scale work: fruit placement radius 350 mm and food-contact radius 400 mm; crumbs/vinegar placement radius 200 mm; lamp/shade/fan placement radius 250 mm. Odor source radius is 750 mm, light/shade radius 1500 mm, fan reach 3000 mm, half-width 750 mm and peak wind speed 500 mm/s. This probe changes none of them. Actual measured ground speeds here range 71.54–90.38 mm/s, with median 82.66 mm/s; the coefficient is not a constant realized speed.

## Anatomy and envelope

`envelope.json` measures the unchanged GLB at the supplied 3 mm scale through 101 absolute phases of each Walk/Fly/Land/Feed clip. It calls posed `getVertexPosition`, applies world transforms after skeleton updates, and follows the existing FlyMotion phase mapping. Antenna-tip centres use each posed tip mesh's bounding-box centre, rather than a tessellation-biased vertex average. The maximum sampled floor-plane radius is 2.294840 mm; the rest AABB-corner radius 2.631336 mm already exceeds it by 14.66%. The diagnostic radius is the larger of that rest envelope and a ten-percent margin over sampled vertices. This is a provisional finite-sampling envelope, not proof of the continuous animation bound or an accepted production collision parameter. Land is clamped; looping endpoint samples follow production wrap-to-zero behavior.

## Aliasing before detector calibration

The canonical field sampler returns a nearest cell value. At heading zero, a 4097-position scan across one 250 mm cell found equal left/right values at **4090/4097** anatomical positions. Only seven boundary-straddling positions triggered the frozen detector, versus **4097/4097** at the current 300 mm span. The nonzero anatomical contrast jumps to 15.77%, rather than changing smoothly with position. Every scanned point clears the unchanged absolute 0.05 amplitude floor (minimum max(L,R) is 0.3860). Thus the measured failure is predominantly identical-cell sampling, not merely a contrast just below five percent. Lowering a contrast cutoff cannot create a left/right difference where the sampler returns equal values. The old fixture starts exactly on a grid boundary, which can conceal this defect.

The moving reproduction uses the existing mirrored excitatory and inhibitory odor scenes, real graph, gain one, three paired seeds, sixty stationary neutral brain warmup ticks and one hundred ground-moving ticks. Warmup is a scientific control only. The same canonical sample_point, cue_currents, Brain, desired_pose and Geometry sweep functions own the calculation. Both lateral and forward anatomical coordinates are supplied only in this diagnostic; the production FieldConfig and adapter remain unchanged. The current production collision radius is the reference (the older Chamber fixture itself uses 500 mm). No measured tick was collision-clipped, so the radius difference does not explain these signal results. This ground-body sensory fixture deliberately excludes reserve and flight-mode transitions, as the existing field probe does.

| Input dimensions and initial grid position | Excitatory cue-active ticks / 100, mean of six mirrored runs | Inhibitory cue-active ticks / 100 |
|---|---:|---:|
| Current span, boundary | 75.67 | 93.17 |
| Current span, cell centre | 75.50 | 96.00 |
| Anatomical span, boundary | 1.67 | 1.67 |
| Anatomical span, cell centre | 0 | 0 |

All twelve anatomical cell-centre runs have exactly the same motor and body trajectory as their matched neutral control. Boundary starts have only one to three active ticks. Every bilateral pathway-silenced run matches its separately silenced neutral motor/body control, and its actual external current is zero. Reports distinguish proposed/requested adapter current from effective current read from Brain after silencing. A telemetry-only rerun preserved all 144 motor/body trajectories exactly. Three seeds characterize this bounded reproduction; no population-level or campaign success claim follows.

## Correction seam, not implemented here

First measure a wall-aware continuous reconstruction at `FieldSet::sample_point`, preserving the grid evolution, source mass, geometry occlusion, anatomical coordinates and five-percent detector. It must remove within-cell plateaus and boundary impulses without interpolating through walls or solids. Validate sampling phase continuity before any neural adapter change. Refining the entire room grid to submillimetre cells would multiply work and is not the default correction.

Then rerun the frozen detector. If smoothly reconstructed anatomical contrast remains below five percent, retain that second failure and specify a separate sensory-adapter correction with mirrored, neutral and silenced controls. This reproduction does not justify quietly lowering the cutoff, restoring oversized antennae, or adding direct turn control. Anatomical forward/lateral coordinates belong to FieldConfig; their height needs an explicit planar-model decision. Vision uses the same current sampling pair but was not validated by these odor-only probes.

`summary.json` is the compact result; `raw.json.gz` preserves every phase sample and measured tick. `measured-probe.rs` matches the recorded source hash exactly; the current example adds only a coordinate-equivalence unit test after the measurement. `source.json` fingerprints unchanged production sources. Run `bun packages/game-renderer/tools/fly-envelope.ts OUTPUT_JSON` and `cargo run -p sim --release --example physical_sampling -- GRAPH_DIR OUTPUT_JSON` to reproduce. The coordinate-equivalence test passes against the canonical legacy sampler. This is native diagnostic evidence; no new WASM/browser or visual-overlay acceptance is claimed. No production parameter, graph, neural equation, ongoing steering or campaign batch changed.

Root independently reviewed the probe source and this interpretation before commit: canonical-coordinate equivalence, matched silenced-neutral controls, scientific-only warmup and the alias/threshold distinction were accepted as diagnostic evidence. This review does not accept revised production dimensions or a sampling correction.
