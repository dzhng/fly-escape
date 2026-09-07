# Native fly contact

The render GLB is the authority for the fly's native dimensions and animation.
`contact-hull.json` stores a convex envelope in metres relative to that model's
support pivot; zoom-dependent display enlargement never changes this geometry.
The source hash ties the bake to the GLB without shipping the GLB inside WASM.

Regenerate from the repository root with:

```sh
bun apps/asset-lab/scripts/export-fly-contact.ts assets/fly/fly.glb assets/fly/contact-hull.json
```

The exporter samples each animation using the production pose sampler and takes
the convex union. This is a **provisional finite-sample envelope**, not a guarantee
that every intermediate animated vertex lies inside it. Moving contact acceptance
must still establish acquisition, supported movement and departure; this asset
alone proves none of those behaviors. The convex union also fills the spaces
between legs and wings, so it is an envelope rather than an exact body surface.

## Conservative derivative candidate

`contact-envelope-candidate.json` is an offline, outward approximation of the
full finite-sample hull. It is **not selected by the simulator**. Its source-hull
hash preserves the exact reference bytes as well as the GLB identity. Preparation
is reproducible through the same exporter by supplying a third output path:

```sh
bun apps/asset-lab/scripts/export-fly-contact.ts assets/fly/fly.glb assets/fly/contact-hull.json assets/fly/contact-envelope-candidate.json
```

The exporter delegates native geometry to the
[offline Rust generator](../../crates/sim/examples/export_fly_contact_envelope.rs),
using the simulator's pinned Parry dependency without adding browser code.
Supporting planes contain the source points; adaptive refinement reduces the
largest outer-vertex distance. Polar triangle facets must remain unmerged during
refinement, because merging can cut into the source. Final vertices come from
clipped plane-pair intersections, with edge incidence retained from those planes.
This avoids reconstructing feature topology from almost coplanar points: a
point-support hull can be valid while its reconstructed face inventory is not.
There is one canonical vertex array; each edge references its two vertices and
two incident planes. Plane offsets and vertices use metres. Incident axis planes
retain exact source extrema, including floor height, without padding.

All stored measurements use metres. Maximum outer-vertex distance bounds the
outward support error of nested convex bodies over all directions, subject to the
reported numerical containment residual and projection accuracy. The validation
roundoff allowance is only a rejection check; it never changes geometry or query
clearance. This derivative inherits the finite-animation limitation above and
still needs moving-contact acceptance before adoption.

The generator validates halfspace feasibility, edge incidence and closed face
cycles. Very short positive edges retain their identities; coordinate proximity
never merges them. Floating-point validation and deterministic regeneration do
not prove the exact signs of all near-zero clipping intervals. Exact offline
plane audits must use the serialized units, since unit conversion can round plane
offsets. The boundary remains a candidate pending those audits and moving cases.

The [core contact boundary](../../crates/sim/src/surface/README.md) owns validation
and the bounded fixed-orientation support query; body adoption remains separate.
