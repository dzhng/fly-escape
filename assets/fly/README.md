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
