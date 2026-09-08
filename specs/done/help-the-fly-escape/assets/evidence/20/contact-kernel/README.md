# Authoritative contact-query kernel

The core now owns a bounded immutable scene of indexed surfaces and a convex query hull rooted at the model's native support pivot. A sweep returns the first impact fraction, stable surface ID, world point and unit normal. A downward query locates a potential support point; it does not itself land or feed the fly. Equal-time ties use the lower stable ID. Existing planar wall/furniture geometry is not duplicated or bypassed by this pass.

Native tests prove first-contact ordering, native pivot placement, misses, departure from curved fruit at fly scale, split-segment agreement, repeated exact results, and tilted support orientation. Invalid IDs, indices, degenerate/flat hulls, triangle geometry, normals and query inputs are rejected. In particular, Parry accepts a coplanar hull; the core rejects its zero volume before allowing a body query.

The complete sim suite, TypeScript check and strict Rust clippy pass. The core itself was compiled into a temporary WASM harness and executed in Chrome: five curved contacts and support queries repeat100 times each, then the browser repeats the matrix10 times, with exact native/WASM values. The source bundle contains the actual sim dependency and input fixture; it is a harness, not another simulation. `normalization-falsification.txt` records the production kernel failing when internal millimetre normalization is removed, followed by a green restored test.

Public data is metre-based and derives TypeScript from Rust. Parry0.30.2 uses scalar enhanced-determinism and supplies queries only. No rigid-body solver, steering controller, body-state change or runtime food activation is introduced. No performance or visual acceptance claim follows from these numeric checks.

Root reviewed shape, diff and docs; independent agent/CLI review remains unavailable as previously recorded. This is a component checkpoint within20. Next: validate the native fly support shape visually and connect height/normal/contact identity through body state and replay before accepting food mechanics.
