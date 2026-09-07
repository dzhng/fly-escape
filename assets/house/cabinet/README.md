# Closed-base cabinet

Original Blender geometry, authored in metres with a grounded centre pivot, +Y up in GLB and +Z front. The native XYZ dimensions belong to [the shared house catalog](../catalog.json):1.2m wide ×0.45m deep ×0.85m tall. The closed plinth deliberately offers no apparent under-cabinet route. `author.py` produces a separate asset scene and neutral authoring stage, the GLB, .blend and three stage renders. No downloaded models or textures.

The production renderer loads this model by its catalogue identity on an existing
solid. Its native dimensions must agree with that solid's physical footprint;
do not stretch it into unrelated props. [Furnishing identity evidence](../../../specs/help-the-fly-escape/assets/evidence/20/furniture-identity/README.md)
separates verified loading and occupancy from the remaining realistic-art gates.

The authoring script validates both the authored scene and a fresh GLB import
against that catalog within1e-6m. A changed dimension requires re-authoring;
it never stretches the finished cabinet to hide an envelope mismatch.

[Shared authoring validation](../authoring.py) owns native envelope checks and
static GLB export/import cleanup for house assets.
