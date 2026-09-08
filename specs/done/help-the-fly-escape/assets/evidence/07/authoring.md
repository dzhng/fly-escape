# Fly authoring preparation

Candidate preparation only; slice 07 remains open until the production asset lab, replacement/disposal checks and camera-distance review exist. The Blender renders establish shape readability, not browser performance or final art acceptance.

The editable [fly source](../../../../../../assets/fly/fly.blend) was authored through Blender MCP, with geometry regeneration in [author.py](../../../../../../assets/fly/author.py). The [GLB](../../../../../../assets/fly/fly.glb) contains only fly geometry. [Source inventory](source-inventory.json) was read back from the saved Blender library and proves it contains only the fly scene, its geometry and neutral review lighting/camera, not other open Blender work.

[Round-trip measurements](roundtrip.json) come from importing that GLB into a separate Blender scene. Head and abdomen translations read directly from glTF establish forward asymmetry: head positive Z, tail negative Z. Blender -Y forward converts to glTF +Z, Blender Z height to glTF +Y. The root is identity at ground contact; the lowest imported vertex differs from zero by less than 1e-9. One Blender unit equals one game world unit; final gameplay scale remains the renderer's responsibility. No action or root-motion animation is included.

## Reversible design choices

- Enlarged faceted eyes and three overlapping abdomen segments favor recognition at small size over biological photorealism.
- A dark chitin surface, warm eyes and pale alpha-blended wings provide three material roles without textures. This palette is provisional and outside the silhouette acceptance decision.
- Six segmented legs and separate named wing meshes preserve editable parts for animation. Parts currently parent directly to the root; joint pivots/rig and playback clips belong to slice 08.
- Veins are thin geometry in the chitin material. Forty meshes stay editable, but per-fly draw-call cost still needs browser measurement before deciding batching or instancing.

## Capture inspection

[Perspective](perspective.png), [side](side.png) and [front](front.png) show the actual authored geometry using neutral illumination. The initial perspective was reframed until every foot and wing fitted in the image.

A fresh subagent critique could not start because the team thread limit was reached. Adversarial self-review, pending the required independent final asset-lab critique:

- The polygonal wing outline could read as paper rather than membrane; the translucent surface and veins help, but rounded tips are a candidate refinement after production close/follow review.
- Butt-ended leg cylinders expose small hard creases at the knees. They remain visibly attached in these stills; motion may require rounded joint geometry.
- The front camera hides abdomen segmentation and overlaps the rear legs. The side and perspective captures establish the missing depth; a game camera must preserve comparable cues.
- The wings are nearly edge-on from the front and may disappear at small sizes. The angled production camera remains the decisive test.

Shape/code/docs review found no runtime owner added and no unrelated files. The script owns geometry regeneration; the editable Blender scene owns manual review setup. No UI, renderer, simulation or animation changes are included.
