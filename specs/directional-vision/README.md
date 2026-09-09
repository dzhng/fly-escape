# Coarse directional vision

Objective 2 gives each fly eight horizontal brightness inputs at its simulation position and heading. It replaces antenna brightness as the visual detector while retaining the existing neural group mapping for the next objective's investigation. Odor sensing stays at the antennae. This is a single vertical slice: one sensory contract from native field sampling through recorded browser playback. No new player interface or puzzle ships here.

## Next Agent Prompt

Implement and verify the single slice below. Current state: specified, no implementation. Complete this objective before specifying neural mapping. Preserve 16 flies, 2/5/10 stars and About. Update this handoff after the pass.

- [ ] Implement directional sampling and wire its record contract.
- [ ] Run rotation, brightness, wall/furniture/shade blocking and determinism tests.
- [ ] Verify native computational cost, full-population record capacity and browser decode/seek.
- [ ] Review, consolidate choices and close-spec.

## Contract and ownership

`FieldSet` remains the single owner of environment sensing. `SensorySample.vision` contains `brightness: [f64; 8]` and `blocked: [f64; 8]`. Bin zero faces forward; bins advance by 45 degrees in increasing simulation heading (positive z from heading zero's positive x). Values are modeled brightness units, finite and nonnegative. `blocked` is the brightness contribution withheld by opaque geometry or shade, not an inferred object identity. Record the exact pre-neural sample at `inputPose`, never recompute it from the rendered camera or interpolate between neural ticks.

Retain only Lamp and Shade sources in FieldSet's immutable visual source list. At each sample, each lamp contributes `rate * max(0, 1-distance/radius)` within its existing authored radius. Spread that contribution over the eight angular directions with a nonnegative cosine lobe (`max(0, dot(direction, sourceBearing))`). A lamp at the sample position contributes uniformly. Each source requires one existing `Geometry::line_of_sight` query, not one per bin. An opaque wall or furniture footprint blocks the lamp entirely. Geometry stays conservatively planar, matching current field/collision geometry; this is explicitly not a retinal image or height-aware optics model.

Shade contributes local attenuation using its existing radial footprint and line of sight to the fly. Subtract that amount from every bin, including ambient, clamped at zero; record the removed amount alongside light lost to geometry. Shade is an authored darkening region, not a newly invented wall. Baseline brightness contributes equally in every bin. Cap intermediates and final outputs at a documented finite modeled maximum (delegated numerical choice) so extreme accepted source rates cannot create nonfinite records.

The existing `CuePathway::Vision` adapter reads hemisphere means from these directions rather than `left/right.brightness`. Left bins are 5,6,7 and right bins 1,2,3; forward/back bins are symmetric and do not create a side preference. Existing group membership and binary winner selection remain unchanged until objective 3 researches and validates graded circuit mapping. No motor command, exit direction, odor or player-camera value enters vision. Two-point FieldSample brightness remains for field diagnostics, not visual neural detection.

Native record schema advances from 4 to 5. Append sixteen float64 fields (eight brightness then eight blocked) to the existing fixed values, preserving existing offsets; export generated types and update the TypeScript archive's required fields/decode. No compatibility reader for old in-memory attempts: builds and workers use the same version and saved campaign arrangements have no record data. Native and TypeScript round trips must preserve every bin exactly, including terminal absence. Avoid a second recording channel or frontend recomputation.

## Bounded work and acceptance

At most 256 sources and existing bounded wall/solid geometry are already validated. Add a vision source-times-obstacle work limit of 65,536 per sample at FieldSet construction; reject excessive combinations rather than silently skipping blockers. Sampling is O(sources * obstacles + 8 * sources), uses fixed arrays and makes no per-fly allocation. Measure at least 10,000 samples at a 16-fly population-equivalent load in release mode, reporting both campaign rooms and a lamp/shade fixture. Target <1 ms per full 16-fly sensory tick on this machine; compare before/after native attempt throughput and require <10% overhead on representative campaign work. Record deterministic checksum and all timing conditions; do not infer universal hardware performance.

The full 16-fly, 6,000-tick archive stays below the existing 128 MiB cap. Do not increase archive quota or reduce population/round duration. Browser worker transfer, archive decode and seek must expose finite eight-element arrays identical to native fixture values at sampled ticks. Run a real 16-fly campaign attempt through initial playback, pause, seek and rewind; require advancing truthful cursor, no transport error and no clock underrun during the bounded check. Core tests cover: heading rotation permutes bins; a brighter lamp increases the corresponding bins; a wall blocks and records missing light; furniture also blocks; a doorway restores visibility; shade reduces local brightness; uniform ambient has no lateral contrast; deterministic repeat; invalid work budget rejected. Extend existing behavioral tests rather than test constants alone.

There is no intended visual design change. Preserve the retry/campaign appearance. Any browser screenshot used for acceptance receives an unprimed screenshot-critique; compare-screenshots applies if the visible surface changes. Final sensory display belongs to objective 5. Human feedback remains nonblocking.

## Decisions and scope

Eight horizontal channels are a deliberate coarse model, not claimed MaleCNS retinotopy. Retinal cell annotations and circuit mapping belong to objective 3; no new biological claim is made here. Analytic lamp bearing preserves brightness and direction without rendering per-fly cameras or sampling many grid cells along rays. The existing source radius remains the local range instead of inventing global illumination. Conservative footprint occlusion can hide light behind low furniture even while flying; document it rather than silently claiming 3D vision. This choice keeps the first useful detector bounded and independently testable.

The plan has one owner per concern: FieldSet sensing, SensorySample data, native record layout, TypeScript decode, existing cue adapter. No new cache, service, separate worker, visual renderer or graph extraction. Internal helper naming and test fixture shape are delegated; mapping, bin order, attenuation, record ordering, scope and acceptance are fixed here.
