# Closed-base upholstered sofa

Original Blender geometry, authored in metres with a grounded centre pivot,
GLB +Y up and +Z front. The authoring script reads the native XYZ dimensions
from [the shared house catalog](../catalog.json):1.9m wide ×0.85m deep ×0.85m tall.
The closed floor base fills that rectangle; there is no apparent route beneath
it. Two seat cushions, two back cushions, arms and a back define the silhouette.
One neutral material isolates shape. No downloaded assets or textures.

`author.py` creates separate asset and neutral authoring-stage scenes, exports
only the asset scene, and saves both in `sofa.blend`. Run it through Blender's
Python environment with `__file__` set to this source path. Existing scenes are
preserved. Stage cameras, floor and light are excluded from `sofa.glb`.
Both the authored scene and a fresh GLB import must match the catalog bounds
within1e-6m. A mismatch fails authoring; the model is never stretched to pass.

This is preparation only. Per-key production loading, authoritative furnishing
occupancy, browser shape review and natural materials remain in20–22. Do not
pass this native metre asset to the unit-solid loader or stretch it into a
new occupancy footprint. [Preparation measurements and renders](../../../specs/help-the-fly-escape/assets/evidence/21/sofa-prepared/README.md)
record the current limits.

[Shared authoring validation](../authoring.py) owns native envelope checks and
static GLB export/import cleanup for house assets.
