"""Execute in Blender with __file__ set. Only new kit scenes are authored/saved.
GLB +Y up, +Z forward. Wall stretches along X; floor stretches along X and Z.
"""
from pathlib import Path
import bpy
import bmesh
import runpy

OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
scenes = []
house_material = runpy.run_path(str(OUT / 'materials.py'))['house_material']

for name, dimensions, center in [
    ('wall', (1, 0.12, 2.5), (0, 0, 1.25)),
    ('floor', (1, 1, 0.25), (0, 0, -0.125)),
]:
    scene = bpy.data.scenes.new('HouseKit-'+name)
    scene.unit_settings.system = 'METRIC'
    scenes.append(scene)
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        for axis in range(3):
            v.co[axis] = v.co[axis]*dimensions[axis]+center[axis]
    # Preserve the whole contact footprint. Floor bevels live underneath;
    # wall bevels soften only the top longitudinal edges, never doorway ends.
    if name == 'floor':
        edges = [e for e in bm.edges if all(abs(v.co.z+0.25)<1e-6 for v in e.verts)]
    else:
        edges = [e for e in bm.edges if all(abs(v.co.z-2.5)<1e-6 for v in e.verts)
                 and abs(e.verts[0].co.x-e.verts[1].co.x)>0.9]
    bmesh.ops.bevel(bm, geom=edges, offset=0.018, segments=3, affect='EDGES')
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name.title()+'Panel', mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(house_material(name))
    obj['coordinate_convention'] = 'GLB +Y up, +Z forward'
    obj['world_units_per_blender_unit'] = 1.0
    obj['ground_contact_description'] = 'origin at floor-top center' if name=='floor' else 'origin at wall-base midpoint'
    obj['stretch_axes'] = 'X,Z' if name=='floor' else 'X'
    obj['native_extent_xyz_gltf'] = [1,0.25,1] if name=='floor' else [1,2.5,0.12]
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')), export_format='GLB',
            use_active_scene=True, use_selection=False, export_yup=True,
            export_animations=False, export_extras=True)
bpy.data.libraries.write(str(OUT/'house.blend'), set(scenes), fake_user=True, compress=True)
print('Saved scoped modular kit:', [s.name for s in scenes])
