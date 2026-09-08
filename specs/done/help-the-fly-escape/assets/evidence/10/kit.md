# Neutral modular house kit

Preparation only. Slice 10 remains open: authoritative layout integration, door/reachability fixtures, cutaway, replacement/disposal and production visual review are not part of these assets.

[house.blend](../../../../../../assets/house/house.blend) contains only two independent mesh scenes and one neutral material, verified by [source inventory](source-inventory.json). [author.py](../../../../../../assets/house/author.py) regenerates them through scoped Blender operations. Each exported GLB contains one mesh, one material, 36 triangles, no textures and no animations. No decorative objects or doorway bridges are introduced.

## Renderer mapping

| Asset | GLB native bounds | Placement and scaling |
| --- | --- | --- |
| [wall.glb](../../../../../../assets/house/wall.glb) | X ±0.5; Y 0…0.6; Z ±0.06 | Origin at wall-base midpoint. Scale X by segment length; rotate around Y by `-atan2(dz, dx)`; translate to segment midpoint. Keep Y/Z scale 1 to preserve height/thickness. |
| [floor.glb](../../../../../../assets/house/floor.glb) | X/Z ±0.5; Y −0.25…0 | Origin at floor-top center. Scale X/Z by room width/depth, translate to room center; keep Y scale 1. |

Both export +Y up and +Z forward with identity object transforms; one unit equals one game world unit. The wall's longitudinal/stretch axis is X so its existing renderer placement formula remains applicable. Place one wall piece for each authoritative segment. A doorway is the absent segment, never a separate model spanning the opening.

## Shape choices and risks

The wall softens only its two top longitudinal edges. Its base footprint and flat end planes retain the complete segment extent, so the bevel cannot extend into a doorway. The floor bevel is on the underside, preserving a full flat top at Y=0 and preventing decorative seams between adjacent floor tops. The neutral rough material is a geometry-review surface, not a final palette.

The wall remains 0.12 units thick and 0.6 units high; floor thickness stays 0.25. Nonuniform floor scaling also scales its underside bevel horizontally; it does not move the top. Very short wall segments compress along X without widening their footprint. Renderer corner overlap/cutaway and joins still need the authoritative room fixture: these pieces deliberately do not infer corners or trim openings.

## Evidence

[Blender round-trip](blender-roundtrip.json) and [Three.js r185 load](three-kit.json) independently measured the expected bounds. A Three consumer probe scaled a floor to an unequal 5×3 rectangle and mapped a wall between (−2,4) and (3,7), establishing X/Z scaling and the non-axis-aligned rotation sign. Both endpoints matched within 1e−6; no runtime edits were needed.

[Wall](wall.png) and [floor](floor.png) are neutral Blender renders of reimported GLBs. Author inspection found intact end planes and a flat floor top, with no clipped framing. A fresh critique could not start because the team thread limit was reached. Adversarial inspection: the wall's top bevel reads somewhat like a narrow cap under strong light; the floor's underside bevel is barely visible from above. These do not establish final room readability and remain subject to the production fixture and independent critique.

Shape/code/docs review keeps the kit to one generation script and two meshes; the asset contains no duplicated room layout, collision logic, renderer owner or deployment dependency. No additional geometry is needed to express doors.
