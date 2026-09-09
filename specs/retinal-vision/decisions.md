# Decisions, alternatives and plan audit

This is the canonical synthesis. Independent drafts and the early grayscale proposal are superseded by this plan; they are not alternative implementation instructions.

## User constraints carried into the plan

- Paired left/right eye views should show the actual sampled visual input that drives the neural system, inspired by the linked FlyGym demo.
- The user explicitly placed these previews in **each fly’s detail view in the right column**, similar to the reference. Every fly uses the same directly visible L/R pair; selecting a fly switches the samples. The preview row sits above the existing brain/traces, preserving their order.
- Low spatial resolution is welcome for performance. The user subsequently rejected grayscale: final eyes and neural inputs must retain useful color information. Spatial/brightness and chromatic downstream responses now have separate proof slices.
- Start with one fly, then use the same path for sixteen campaign flies. The initial accepted proposal did not promise reliable navigation; the user expects color to matter, which requires testing rather than inventing a preferred reaction.
- No old-replay compatibility or migration. The explicit additional requirement is no crash on seeing an old replay: version rejection is a handled recoverable result, not an uncaught exception.
- Saved progress/arrangements remain intact. Do not create new `codex/` branches after the user's branch cleanup request. This task writes a spec only.

## Independent drafts and synthesis

The write-spec workflow requested three blind whole-plan drafts against the same brief and current integrated source. Two Codex drafts used fewest-slices and risk-first biases; a Claude Opus/high draft used seam-quality bias. Each inspected source independently. Their recommendations were considered, not accepted on authority. After the user's color correction, two drafters independently re-audited color scope and retained-cell evidence.

| Draft | Useful contribution | Why the final plan differs |
| --- | --- | --- |
| Fewest slices | Three visible milestones: prove eyes, connect/replay one fly, scale; test CPU sensing as a way to retain native synchrony | Its combined middle slice hides projection, channel mapping, tick timing, archive and UI risks. The final plan splits those contracts and retains the three milestones in the visual roadmap. |
| Risk first | Quantify raw/compound replay cost; capture full pre-neural height/quaternion; bound GPU rendezvous; use exact consumed bytes as replay oracle | Accepted. The final plan freezes a limited profile matrix and separates spatial from chromatic proof after the color correction. |
| Claude seam quality | One owner per scene/sensor/map/archive; clean removal of old directional input; explicit retained-population asymmetry | Accepted those invariants. Rejected its CPU 2.5-D scene plus replay recomputation as the chosen default: existing footprints do not represent authored image/color content, source illumination can evolve, full orientation was missing, and it would create another optical model. |

The drafts agreed on explicit registration assumptions, no hand-written target steering, no imported FlyWire IDs, bounded recording and reuse of existing ownership. They disagreed on CPU versus GPU optics and stored versus reconstructed eye images. The final choice follows the user's desire to inspect images of the rendered world and preserve color through the circuit.

## Architectural choices and rejected shortcuts

**Choose a browser optical capture spike first.** Shared authored mesh/material/light construction is closer to the requested example than raycasting planar collision footprints. Small textures still pay draw submission and readback costs, so performance is a prerequisite, not an assertion. If the tested worker architecture fails, explicitly revise the backend slice. A deterministic CPU triangle renderer remains a research alternative; do not build both permanent backends speculatively.

**Record pooled RGB8, not full videos or reconstructed eyes.** The archive stores exactly the quantized spatial/color samples consumed by the adapter. Recomputing from a replay pose risks changes from assets, shader/device behavior, scene state or incomplete pre-neural transforms. At the revised candidate, color samples alone cost 415,296,000 bytes for a sixteen-fly, 6000-tick round. Complete quota admission remains a gate.

**Color and meaningful spatial detail.** Grayscale contradicted the user's goal; the later 61-cell RGB candidate also lost too much structure. The current candidate is 721 RGB8 cells per eye from 128×128 acquisition. The user delegates practical resource-budget decisions; the archive target is now 512 MiB, with total memory to be measured. Profile comparisons may change spatial density, never silently remove chromatic channels or adapt sampling to frame rate.

**Color panels and color processing are separate obligations.** Existing Tm2 injection is a brightness model. The source-informed color adapter needs its own evidence and frozen parameters, plus a matched-brightness downstream experiment. Neither a colorful UI nor activity differences in directly injected cells prove chromatic propagation. RGB cannot reveal UV reflectance; no UV values or color-dependent target semantics are fabricated.

**Do not change the brain to make the demonstration succeed.** The plan can investigate already-retained color-related cells. Adding missing neurons/circuitry, modifying dynamics or training a controller would be a new slice graph with new claims. Negative results remain negative; failure is not permission to tune a motor response.

**Separate scene instances, one construction owner.** The sensory instance uses simulation time and physical visibility; the player's instance uses playback time and cutaways. Their transforms/material visibility cannot be shared mutable state. Their geometry/assets/light authoring should share construction and definitions. This is necessary instance separation, not permission for copied room data.

**Native verification uses input batches.** GPU-generated images are not claimed bit-identical across hardware. Native/WASM circuit checks consume the same exported RGB8 batches; replay byte equality is exact. No old optical sampler masquerades as the new sensor in native probes.

## Recursive fog audit

| Hidden variable found | Owning slice / closure rule |
| --- | --- |
| Two camera transforms, units, fisheye and image handedness | 01 reproduces before translation; 03 attaches the rig to our full native transform. |
| Low resolution may still incur expensive draw/readback costs | 02 benchmarks real assets and actual worker support before a production backend is committed. |
| Source images and retained samples have different memory costs | 02 computes admission; 07 tests final packer; 11 measures full-round peak memory. |
| Current pre-neural record lacks height/quaternion | 06 freezes full state; 07 records it before any body update. |
| Color was omitted in the initial draft | Superseded everywhere: RGB8 profile, 04 color-model research, 09 chromatic proof. |
| Annotation columns are not calibrated retinal angles | 05 labels modeled registration and support holes; no behavior-driven axis flips. |
| Type labels do not imply spectral response or UV from RGB | 04 owns a source-to-parameter ledger and can fail without enabling a fake mapping. |
| Late capture can contaminate a new attempt | 06 request identity and cancellation tests before replay/UI work. |
| Old records could throw during typed decoding | 07 public boundary checks and recoverable UI; repeated in final build. |
| Larger neural input might change compute load | 11 reruns complete production benchmarks after both neural proof slices. |
| Paired views could show playback render rather than actual input | 07 exact archive bytes; 10 is a read-only display consumer. |

Every future freedom is either named in a slice's decision budget or an explicit evidence gate. Numeric rig conversion, profile selection within a small matrix, and source-based color-model selection are intentionally delegated experiments. Falling back to grayscale, 1-D sensing, arbitrary color-cell assignments, a new controller or a larger archive is not delegated.

## Refactor-clean and scrollback review

The materialized plan was checked against the refactor-clean skill. One owner is named for authored world construction, eye profile, simulation time, color/spatial map, current conversion, record layout, archive and selected-eye display. Temporary baseline controls end in slice 11; the acquisition probe's scene fixture adapter ends in slice 03. No old replay decoder survives. No generic provider registry, backend framework, separate per-fly queue or video cache is required.

The scrollback review carried forward low resolution, actual eye-to-neuron correspondence, the one-fly checkpoint, sixteen-fly scale, preserved game settings, clean old-replay failure, explicit color sensitivity, and the fact that the reference's visual steering is hand-written. The early grayscale draft and CPU/recompute alternatives are recorded here only to explain why they lost. No prior proposed draft is an active handoff.

A final independent consistency review found and resolved three gaps: transition ticks keep the eyes consumed before the fly becomes terminal; map freezing depends on the completed slice-03 rig identity; and spatial taps stay nonnegative while only the frozen chromatic model may contain signed feature coefficients. The review found no remaining active grayscale requirement and confirmed the initial RGB history arithmetic and handled old-version contract.

The implementation wavefront separates slice 04’s source/retained-cell audit from slice 01’s optical reproduction: neither consumes the other’s output. Their results meet at slice 05. This removes a planning-only dependency without weakening either acceptance gate.
