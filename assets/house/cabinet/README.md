# Closed-base cabinet

Original Blender geometry, authored in metres with a grounded centre pivot, +Y up in GLB and +Z front. The native XYZ dimensions belong to [the shared house catalog](../catalog.json):1.2m wide ×0.45m deep ×0.85m tall. The closed plinth deliberately offers no apparent under-cabinet route. `author.py` produces a separate asset scene and neutral authoring stage, the GLB, .blend and three stage renders. No downloaded models or textures.

This is shape preparation only, not a production house-kit replacement or accepted furnished-game asset. Per-key loading and authoritative footprint integration belong to spec20/21; natural materials belong to22. Do not pass this metre-scale model to the old unit-solid loader or stretch it into unrelated props.

The authoring script validates both the authored scene and a fresh GLB import
against that catalog within1e-6m. A changed dimension requires re-authoring;
it never stretches the finished cabinet to hide an envelope mismatch.

[Shared authoring validation](../authoring.py) owns native envelope checks and
static GLB export/import cleanup for house assets.
