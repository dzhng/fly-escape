# Food geometry and attempt ownership

Component verdict: food geometry/identity is implemented. Supported apple movement, native hull adoption, recorded support and curved playback are still open; this does not accept20 or final fruit art.

## Shared geometry

`FoodDef` resolves an authored apple or a controlled floor patch into the existing `ContactSurface` boundary. Fixed food precedes sorted placements, assigning stable within-attempt IDs. Atomic placement state carries these surfaces; `Attempt` prepares one owned `BodyWorld` before ticking and shares it across all flies. The immutable world owns its geometry snapshot, hazard regions and prepared mesh queries. No acceleration structures are rebuilt in the tick loop.

Food contact now measures three-dimensional distance to edible triangles. It does not interpret a fruit's interior, odor field or former oversized floor circle as food contact. The existing body radius remains a provisional proximity envelope until supported movement replaces it. Hazard and reserved-region circles remain their separate concepts. Floor probes use128triangle disks through the same query path; radius and neural settings are unchanged.

The placement apple keeps native metres. Its loader compares every vertex and triangle with the baked core asset, and rejects extra scenes. Its footprint is measured from that asset and cached; it is not the former35cm display radius or40cm edible radius. Build identity includes the contact asset. Fixed food renders exported triangles directly; placed fruit renders the matching GLB, avoiding duplicate meshes. Obsolete citrus assets and the diagnostic fake scaling path were removed. Scent crumbs remain odor-only floor-cue placeholders; the dedicated contact workbench owns edible inspection.

## Verification and corrected oracle

The former placed-fruit taste test put an8cm diagnostic body45cm from fruit, then expected taste because the old edible circle reached it. The new surface query correctly rejects that empty gap. The updated test pins absence of injected taste there; the existing positive-contact test still verifies exact taste-plus-sensory neural currents on actual floor food. Additional queries pin transformed apple contact, absence of interior/distant contact, flat-patch contact and stable IDs. Replenishment-disabled resolution preserves identical surfaces and sources.

The full sim suite passes. Focused body/record/placement/surface checks, TypeScript,17client tests,31renderer tests and the full WASM/web/workbench build pass. Strict library/test clippy passes; an all-target sweep also exposed the unchanged `physical_sampling` example's argument-count lint, while the new precision-test lint was corrected. No all-target clippy acceptance is claimed.

Browser gates pass real-graph meal extension, eating-neuron ablation, contact loss/starvation, swept exit and same-seed reset. Ordinary food gains3.75reserve and survives to tick173; the silenced control gains0 and starves at108. The real placement boundary preserves inventory, rejects invalid moves and replays exactly. Delayed committed UI edits survive concurrent controls. All seven asset failure/delay probes keep setup/playback blocked until assets are ready and report failures explicitly. Native motion retains every default feeding/landing case and exact pause/reverse pixels.

## Visual evidence and adversarial review

Production `before/after` use the root setup route, the same1440×900viewport, one matching placement, and identical pan/zoom input. The baseline build is58ca870; its later floor-height differences do not affect this no-fly setup capture. The authored apple changes561world pixels in Overview,35,267at close and108,358at extra-close. Full metrics and crops are in `production/`. This proves adoption on the game route, not visual polish.

The initial floor mesh flickered against the coplanar room floor. Raster depth bias fixes visibility without moving contact vertices; debug food retains the green legend. The corrected meal frame changes37,878world pixels. The initial floor-cue capture hid the native fly inside a cue, so cue inspection now defaults beside the fly and its replacement test captures Overview. That is an inspection-framing correction, not acceptance of physical contact with non-solid cues. Native motion now uses the game's presentation without the lifecycle lab's oversized C marker; all motion states remain captured. Failed images stay in `rejected/`.

No independent agent is available because existing agents report usage limits. Primed adversarial fallback, strongest visible failure cases first:

- **Apple readability:** the neutral apple is barely visible in Overview and looks like a small gray ball up close. Verdict: native geometry adoption verified; final materials, recognition and placed-tool readability remain21–24 work.
- **Flat food:** the first patch looks like radiating holes rather than a continuous surface. Verdict: reject that rendering; the final lifecycle set shows a continuous green patch without those holes.
- **Motion:** the initial close sequence includes a large diagnostic marker and cannot support a clean geometry judgment. Verdict: reject it for native inspection; final sequences retain all states with the game presentation and exact reverse seek. They demonstrate floor landing only.
- **Floor cues:** the original close crumb view contains almost no visible fly. Verdict: reject it as inspection evidence. The beside/Overview replacement set shows both objects; non-solid cue overlap is not physical-contact proof and final tool geometry remains open.
- **Curved contact:** none of these moving captures shows a fly acquiring and walking on the apple. Verdict: explicitly unaccepted; this is the next20 pass, including the already observed ring clipping in the apple indentation.

Review shots opened at07:40:57UTC; no feedback arrived during more than five minutes. Proceeded on the component verdict above and closed Preview. Silence is not user approval.

## Closeout

Shape review removed per-tick world construction and the old edible-circle/render-scale owner, cached the native footprint, and kept test food fixtures compact. Code review caught the missing baked-asset build identity, stale consumers, coplanar drawing, misleading workbench framing and a float test that overconstrained future baked transforms. Docs now separate native edible surfaces from odor-only floor cues. No extra runtime dependency or compatibility path was added. Independent CLI review remains unavailable under the previously recorded configured-model failure; only root review is claimed.
