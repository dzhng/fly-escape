# Curved-surface query verdict

Accepted for the next contact-model prototype: Parry f64 continuous shape queries, with metre inputs converted internally to millimetres and results converted back. No rigid-body simulation or runtime dependency is adopted yet. The frozen reproduction contains its exact Cargo lockfile and runs as a standalone crate.

## Evidence

Native analytic ball cases cover landing, crossing through the whole apple in one step, miss, touching departure/return, inward/outward initial penetration. An indexed floor proves a world-space witness and upward normal. Five curved-mesh approaches prove first contact, split-segment agreement within1nm, and departure without a zero-time snag. Equal-contact scene ordering uses stable IDs. Analytic casts repeat100 times; the browser repeats the whole matrix10 times with exact native/WASM numeric values. `report.json` and `browser.json` contain actual values, not just booleans.

Removing the internal unit conversion fails the curved-mesh departure gate: the solver reports a zero-time collision and a sideways normal during upward departure. The normal should permit separation. Oriented/internal-edge mesh flags alone did not fix this. A0.1µm clearance in metre queries also failed. Millimetre queries pass without any clearance; the intermediate clearance and convex-mesh alternative are not adopted. `normalization-falsification.txt` records the final-source mutation failing, followed by a passing restored native run. The same final source was built to WASM and checked in headless Chrome; native/WASM outputs match exactly.

This points to a solver scale sensitivity, not a biological or locomotion change. Internal geometry normalization belongs solely in the future contact-query owner. Public levels, fly dimensions, bodies and records remain in metres.

## Reproduce

Run `cargo run --release --manifest-path reproduction/Cargo.toml` from this folder. For the browser comparison, build that crate using wasm-pack's web target, serve the crate directory and point the saved probe at it. The probe paths reflect the captured local run and are evidence, not a shipped command interface. The test WASM is about388KiB, including query fixtures, assertions and JSON; this is not a production size estimate.

## Review and limits

Root reviewed shape/diff/docs and the choice ledger. Fresh independent agents remain unavailable after the recorded usage failure. No visual acceptance is claimed by a numeric query probe.

The test ball is not the fly body. A planar footprint radius cannot silently become a spherical body: next20 must measure a support shape relative to the native model pivot, then prove landing/feeding/departure without visible penetration or floating. Query success also does not prove mesh validation, walking support transitions, animation/replay, food-dependent campaign success or frame-time budgets. Those gates remain open. The next step is the actual contact owner and body/support contract, preserving this regression.
