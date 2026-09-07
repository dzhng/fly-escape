"""Author one metre-scale sofa; preserve all existing Blender scenes/assets.
GLB +Y up, +Z front, grounded origin at footprint centre. No production materials. Envelope comes from the shared house catalog.
"""
from pathlib import Path
from runpy import run_path
import bpy, bmesh, json
from mathutils import Vector

OUT = Path(__file__).resolve().parent
export_static = run_path(str(OUT.parent / "authoring.py"))["export_static"]
EVIDENCE = OUT.parents[2] / 'specs/help-the-fly-escape/assets/evidence/21/sofa-prepared'
OUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)
catalog_size = json.loads((OUT.parent / 'catalog.json').read_text())['sofa']
width, height, depth = catalog_size
asset = bpy.data.scenes.new('Sofa-ClosedBase-Metres')
asset.unit_settings.system = 'METRIC'
asset.unit_settings.scale_length = 1
neutral = bpy.data.materials.new('Sofa-Neutral-ShapeOnly')
neutral.use_nodes = True
neutral.diffuse_color = (0.5, 0.5, 0.5, 1)
bsdf = neutral.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1)
bsdf.inputs['Roughness'].default_value = 0.65
parts = []

def finish(name, bm):
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(neutral)
    obj = bpy.data.objects.new(name, mesh)
    asset.collection.objects.link(obj)
    parts.append(obj)
    return obj

def box(name, center, size, bevel=0.002, top_only=False):
    # Public inputs follow GLB axes; author geometry is baked into Blender Z-up coordinates.
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vertex in bm.verts:
        p = vertex.co.copy()
        vertex.co = (center[0] + p.x * size[0], -center[2] + p.y * size[2], center[1] + p.z * size[1])
    bm.normal_update()
    edges = list(bm.edges)
    if top_only:
        top = center[1] + size[1] / 2
        edges = [e for e in edges if all(abs(v.co.z - top) < 1e-6 for v in e.verts)]
    if bevel:
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=6, profile=0.5, affect='EDGES')
    return finish(name, bm)

# The closed plinth fills the declared rectangle at floor level. Upper cushions
# change the silhouette, not the existing floor occupancy or simulation geometry.
box('ClosedFloorBase', (0, 0.15, 0), (width, 0.30, depth), 0.025, top_only=True)
box('UpholsteredBack', (0, 0.55, -depth/2 + 0.085), (width, height-0.25, 0.17), 0.055)
for side, x in [('Left', -width/2 + 0.10), ('Right', width/2 - 0.10)]:
    box(side+'Arm', (x, 0.465, 0.015), (0.18, 0.37, depth-0.03), 0.045)
# Two broad cushions and a recessed centre seam; no apparent open passage.
seat_width = width - 0.38
for side, x in [('Left', -seat_width/4), ('Right', seat_width/4)]:
    box(side+'SeatCushion', (x, 0.375, 0.08), (seat_width/2-0.008, 0.15, depth-0.23), 0.045)
    box(side+'BackCushion', (x, 0.635, -0.20), (seat_width/2-0.012, 0.37, 0.20), 0.045)

for obj in parts:
    obj['asset_key'] = 'sofa-closed-base'
    obj['world_unit_metres'] = 1.0
    obj['authorship'] = 'Original procedural Blender geometry; no downloaded models/textures'
    obj['shape_preparation_only'] = True
print('sofa export bounds:', export_static(asset, OUT/'sofa.glb', catalog_size))

# Separate neutral authoring stage. None of these lights, camera or floor enter the GLB.
preview = bpy.data.scenes.new('Sofa-Neutral-AuthoringStage')
for obj in parts: preview.collection.objects.link(obj)
preview.render.engine = 'CYCLES'
preview.cycles.device = 'CPU'
preview.cycles.samples = 32
preview.cycles.use_denoising = True
preview.render.resolution_x = 1200
preview.render.resolution_y = 900
preview.render.resolution_percentage = 100
preview.world = bpy.data.worlds.new('Sofa-Neutral-World')
preview.world.use_nodes = True
preview.world.node_tree.nodes['Background'].inputs[0].default_value = (0.3,0.3,0.3,1)
preview.world.node_tree.nodes['Background'].inputs[1].default_value = 0.5
preview.view_settings.view_transform = 'AgX'
light = bpy.data.lights.new('Sofa-White-Area', 'AREA')
light.energy = 450
light.shape = 'DISK'
light.size = 3
lamp = bpy.data.objects.new(light.name, light)
preview.collection.objects.link(lamp)
lamp.location = (-2,-3,4)
lamp.rotation_euler = (Vector((0,0,0.4))-lamp.location).to_track_quat('-Z','Y').to_euler()
mesh = bpy.data.meshes.new('AuthoringGround')
mesh.from_pydata([(-20,-20,-0.001),(20,-20,-0.001),(20,20,-0.001),(-20,20,-0.001)],[],[(0,1,2,3)])
ground = bpy.data.objects.new('AuthoringGround',mesh)
preview.collection.objects.link(ground)
mesh.materials.append(neutral)
camera_data = bpy.data.cameras.new('Sofa-MeasurementCamera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.8
camera = bpy.data.objects.new(camera_data.name,camera_data)
preview.collection.objects.link(camera)
preview.camera = camera
for name, position in [('three-quarter',(1.8,-2.8,1.8)),('front',(0,-3,0.65)),('rear',(-1.8,2.8,1.8))]:
    camera.location = position
    camera.rotation_euler = (Vector((0,0,0.425))-camera.location).to_track_quat('-Z','Y').to_euler()
    preview.render.filepath = str(EVIDENCE/(name+'.png'))
    bpy.ops.render.render(write_still=True,scene=preview.name)
bpy.data.libraries.write(str(OUT/'sofa.blend'), {asset,preview}, fake_user=True, compress=True)
print('Prepared sofa:', len(parts), 'parts; separate asset and neutral stage scenes preserved')
