"""Mount the native household plant on an authored wall shelf; no floor collision is added."""
from pathlib import Path
from runpy import run_path
import bpy, bmesh

OUT = Path(__file__).resolve().parent
shared = run_path(str(OUT.parent / 'authoring.py'))
material = run_path(str(OUT.parent / 'finish-details.py'))['material']
with bpy.data.libraries.load(str(OUT.parent / 'plant' / 'plant.blend')) as (source, loaded):
    loaded.scenes = [name for name in source.scenes if name.startswith('Plant-Metres')]
source = loaded.scenes[0]
asset = bpy.data.scenes.new('WallPlant-Metres')
asset.unit_settings.system = 'METRIC'
asset.unit_settings.scale_length = 1
clay = material('Terracotta wall planter', '#b47a54', .85)
soil = material('Dark planter soil', '#392c20', 1)
leaves = [material('Deep green leaf', '#405b33', .74), material('Sage green leaf', '#627643', .8)]
wood = material('Walnut wall shelf', '#66452d', .65)
brass = material('Brass shelf support', '#9a7547', .35, .7)

for obj in source.objects:
    if obj.type != 'MESH':
        continue
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.location.z += .215
    copy.data.materials.clear()
    copy.data.materials.append(leaves[len(asset.objects) % 2] if obj.name.startswith('Leaf') else clay)
    if obj.name.startswith('ClosedSquarePlanter'):
        copy.data.materials.append(soil)
        for face in copy.data.polygons:
            if .377 <= face.center.z <= .379 and face.normal.z > .9:
                face.material_index = 1
    asset.collection.objects.link(copy)


def box(name, center, size, finish):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = (center[0] + v.co.x * size[0], center[1] + v.co.y * size[1], center[2] + v.co.z * size[2])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(finish)
    obj = bpy.data.objects.new(name, mesh)
    asset.collection.objects.link(obj)

# Blender +Y is the mounting back; GLB +Z faces into the room.
box('WallShelf', (0, 0, .1975), (.34, .38, .035), wood)
box('WallShelfBackplate', (0, .18, .09), (.10, .02, .18), brass)
box('WallShelfSupport', (0, .065, .16), (.025, .23, .04), brass)
shared['export_static'](asset, OUT / 'wall-plant.glb', [.34, 1.265, .38])
bpy.data.libraries.write(str(OUT / 'wall-plant.blend'), {asset}, fake_user=True, compress=True)
print('Exported native wall plant and supporting shelf')
