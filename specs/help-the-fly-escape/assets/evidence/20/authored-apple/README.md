# Authored apple geometry preparation

Scope: the contact workbench now displays the actual neutral Blender apple GLB and rejects any mismatch with the core's exported contact triangles. This is preparation for the food-geometry pass, not production food contact or final art acceptance.

The first export accidentally included other selected scenes (about5.8MB). Active-scene export reduces it to one28.5kB mesh:762vertices,1520triangles, about80mm across and77mm tall, grounded atY=0. Every edge has one oppositely directed partner, winding encloses positive volume, and no degenerate face remains. Core tests exercise approach, departure and outside-floor contact on five locations while preserving the original sphere regression.

The initial browser run rejected160 coordinates after JSON decoding changed their least-significant bits. Enabling serde_json's `float_roundtrip` feature preserves the exported Float32 values exactly as f64; a regression pins the failing decimal and the complete asset round trip. The same geometry then passes the browser's exact vertex/triangle check. No neural constants or game controller change in this preparation.

## Visual review

Target: the displayed authored surface must be the queried surface, with the native fly attached at the core's fixed pose. Neutral gray, camera intent, viewport and animation samples are held constant. The sphere baseline is a query placeholder, not an aesthetic target. `before/` and `after/` contain every captured sample/clip/full frame/crop; `context/` adds Follow, Extra close and Overview. `comparison/metrics.json` records changed crop pixels, with comparisons beside it. All19named crops change; this is not a no-op. Production gameplay has not adopted this asset yet.

No independent agent was available (the existing agents report usage-limit errors). Primed adversarial fallback, strongest visible failure case first:

- **Contact:** the uniform gray surface offers too little depth information to prove that every foot touches it; some legs appear suspended. Verdict: fixed core pose/mesh correspondence verified, moving hull and foot planting remain unaccepted.
- **Selection:** in the central indentation, part of the planar yellow circle disappears below the apple. Verdict: curved selection attachment needs correction in20's support/replay work; a normal-aligned plane alone is insufficient there.
- **Shape:** the close frame looks like a broad gray surface, and Overview makes the fruit tiny. Verdict: these are useful native-contact and context checks, not proof of recognizable or photorealistic fruit. Final shape/material acceptance stays in21/22.
- **Animation:** a few static phase samples cannot establish a continuous landing. Verdict: reverse-seek pixels and attachment binding pass; physical acquisition, movement and departure still require the recorded body integration.

Accept only the authored geometry/query correspondence preparation. The visual limitations above remain explicit20 work. Review images opened at06:59:53UTC for nonblocking feedback; no feedback arrived during roughly four-and-a-half minutes. Proceeded with the geometry-only verdict above and closed Preview; this is not user approval.

## Verification and review

Six surface tests and the complete sim suite pass, as do TypeScript and the full WASM/web/workbench build. The19-state browser check passes exact pose/quaternion binding, follow centring, exact reverse seek and zero page errors. The separate context captures are correctness evidence, not performance measurements.

Shape review keeps authoring/extraction in the asset workbench and leaves the existing query owner unchanged. The generated fixture replaces its hand-authored sphere; the browser comparison is an independent stale-export check, not another physics owner. The exporter uses the workbench's existing Three dependency. Code review caught and corrected multi-scene export and JSON precision loss. Docs link authoring to the workbench and preserve preparation limits. CLI second review remains unavailable under the previously recorded configured-model failure; no independent review is claimed.
