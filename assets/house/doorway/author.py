"""Native open doorway: a human-sized clear passage beneath a full-height lintel."""
from pathlib import Path
from runpy import run_path
import bpy, bmesh, json

OUT = Path(__file__).resolve().parent
envelope = json.loads((OUT / 'envelope.json').read_text())
clear_width = envelope['clearWidth']
outer_width = envelope['bounds'][3] - envelope['bounds'][0]
shared = run_path(str(OUT.parent / 'authoring.py'))
material = run_path(str(OUT.parent / 'finish-details.py'))['material']
asset = bpy.data.scenes.new('Doorway-Metres')
asset.unit_settings.system = 'METRIC'
asset.unit_settings.scale_length = 1
frame = material('Ivory doorway paint', '#eee4d2', .75)
plaster = material('Warm ivory doorway lintel', '#e0d9c4', .9)


def box(name, center, size, finish):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = (center[0] + v.co.x * size[0], center[1] + v.co.y * size[1], center[2] + v.co.z * size[2])
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=.001, segments=2, affect='EDGES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(finish)
    obj = bpy.data.objects.new(name, mesh)
    asset.collection.objects.link(obj)


# Blender Z is vertical; the opening uses the shared clear width.
for side in [-1, 1]:
    box('DoorFrameLeft' if side < 0 else 'DoorFrameRight', (side * (clear_width / 2 + .03), 0, 1.05), (.06, .16, 2.1), frame)
box('DoorFrameHeader', (0, 0, 2.075), (clear_width, .16, .05), frame)
box('DoorWallLintel', (0, 0, 2.3), (outer_width, .12, .4), plaster)

# Every vertex belongs outside the clear passage; there is no threshold or door leaf.
for obj in asset.objects:
    for vertex in obj.data.vertices:
        x, depth, height = vertex.co
        assert abs(x) >= clear_width / 2 - 1e-7 or height >= 2.05 - 1e-7, (obj.name, vertex.co)
shared['export_static'](asset, OUT / 'doorway.glb', [outer_width, 2.5, .16])
bpy.data.libraries.write(str(OUT / 'doorway.blend'), {asset}, fake_user=True, compress=True)
print(f'Exported {clear_width}m x 2.05m clear doorway with 2.5m lintel')
