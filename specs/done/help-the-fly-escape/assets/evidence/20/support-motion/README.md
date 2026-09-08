# Native supported-motion reproduction

Query correction verified; supported movement is not accepted. The original sampled native hull query returned a blocking hit during a horizontal translation across a flat triangle floor. Downward acquisition and upward departure still work in this reproduction; those earlier gates do not establish supported walking.

The probe uses the existing sampled hull from `../contact-shape/sampled-hull.json.gz`, the authored apple, and the production `ContactScene`. `results.jsonl` starts at each cast-derived landing root. `exact-floor.jsonl` additionally sets the floor root to the negative minimum hull vertex height, removing landing-root error as the sole explanation. Both report false floor obstructions. For example, at the central floor sample a requested 1mm horizontal move reports contact after roughly 60nm even at the exact floor root. Apple horizontal collisions may be legitimate uphill contact; they are not classified as query failures here.

To reproduce, make a temporary Cargo binary depending on this repository's `sim` crate and `serde_json`, use `probe.rs` as its main, and pass the decompressed hull JSON and `assets/food/apple/contact.json` paths. Add `--exact-floor` for the second run. No production schema, controller or clearance changes were made by this probe.

## Query correction

The existing prepared mesh tree supplies triangles intersecting the swept hull bounds. Before casting against each triangle, the query checks whether the whole hull lies on one side of its plane and moves tangentially or away. That triangle cannot obstruct the move. This is a per-triangle exclusion: another face in the same mesh still participates. Geometry and body roots are not offset. Plane classification uses the established cast-test positional precision (10nm) and a machine-roundoff angular check; it is not a clearance shell or a movement controller.

`filtered.jsonl` repeats the full native-hull reproduction. Flat-floor sideways and outward moves pass, while inward moves still hit. The minimized four-vertex regression failed before the correction. A tilted-plane regression also failed before the dot-product roundoff correction. The same-mesh wall regression fails when the triangle exclusion is deliberately widened to ignore the entire scene; the restored code passes. Both windings retain the blocking wall.

All nine surface tests, the complete sim suite and strict library/test clippy pass. The temporary browser harness retains the earlier curved acquisition/departure matrix and adds the full native-hull floor cases. Chrome returns exactly the native values through ten repeated WASM reports. Source and results are archived here. No model, camera or production movement changed, and no visual acceptance is claimed.

Root shape/code/docs review kept the existing query owner, prepared acceleration structures and public API, and moved invariant arithmetic outside the triangle loop. The query visits only overlapping triangle bounds; final attempt performance remains a later integration gate. Independent agent/CLI review is still unavailable under the previously recorded limits.

Next implement supported acquisition, translation and changing orientation before adopting the hull. Passing these query regressions does not establish continuous curved walking or replay.
