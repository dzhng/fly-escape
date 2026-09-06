"""Run through Blender MCP; save/export only the new solid-prop scene."""
from pathlib import Path
import bpy
import bmesh
import runpy

out = Path(__file__).resolve().parent
scene = bpy.data.scenes.new('HouseSolid-Block')
scene.unit_settings.system = 'METRIC'
mesh = bpy.data.meshes.new('SolidBlock')
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1)
for vertex in bm.verts:
    vertex.co.z += 0.5
# Only the top rim softens; the entire floor footprint stays rectangular.
edges = [e for e in bm.edges if all(abs(v.co.z - 1) < 1e-6 for v in e.verts)]
bmesh.ops.bevel(bm, geom=edges, offset=0.015, segments=2, affect='EDGES')
bm.normal_update()
bm.to_mesh(mesh)
bm.free()
material = runpy.run_path(str(out / 'materials.py'))['house_material']('solid')
mesh.materials.append(material)
obj = bpy.data.objects.new('SolidBlock', mesh)
scene.collection.objects.link(obj)
obj['coordinate_convention'] = 'GLB +Y up, +Z forward'
obj['native_extent_xyz_gltf'] = [1, 1, 1]
obj['ground_contact_description'] = 'origin at ground-footprint center; top rim bevel is conservative within collider'
with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
    bpy.ops.export_scene.gltf(filepath=str(out/'solid.glb'), export_format='GLB', use_active_scene=True,
        use_selection=False, export_yup=True, export_animations=False, export_extras=True)
bpy.data.libraries.write(str(out/'solid.blend'), {scene}, fake_user=True, compress=True)
print('Saved isolated solid source and GLB:', scene.name)
