"""Floor-level French window: both glazed leaves swing outward clear of the exit corridor."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, radians
import bpy, bmesh, json
from mathutils import Vector

OUT = Path(__file__).resolve().parent
shared = run_path(str(OUT.parent / 'authoring.py'))
material = run_path(str(OUT.parent / 'finish-details.py'))['material']
asset = bpy.data.scenes.new('OpenFrenchWindow-Native-Metres')
asset.unit_settings.system = 'METRIC'
asset.unit_settings.scale_length = 1
paint = material('Ivory French window paint', '#eee4d2', .7)
brass = material('French window brass handles', '#9a7547', .3, .7)
glass = material('Transparent French window glazing', '#b9d6df', .15, .08)
glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .32
glass.surface_render_method = 'DITHERED'


def box(name, center, size, finish, side=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        x = center[0] + v.co.x * size[0]
        y = center[1] + v.co.z * size[1]
        z = center[2] - v.co.y * size[2]
        if side is not None:
            # Both leaves extend beyond the frame, away from the clear central corridor.
            angle = radians(110)
            x, z = side * (.48 - x*cos(angle) - z*sin(angle)), -x*sin(angle) + z*cos(angle)
        v.co = (x, -z, y)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=.001, segments=2, affect='EDGES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(finish)
    obj = bpy.data.objects.new(name, mesh)
    asset.collection.objects.link(obj)


for side in [-1, 1]:
    box('FrenchFramePost', (side*.48, 1.075, 0), (.06, 2.15, .16), paint)
box('FrenchFrameHeader', (0, 2.10, 0), (.90, .10, .16), paint)
for side in [-1, 1]:
    for x in [.02,.45]:
        box('OpenCasementStile', (x,1.025,0), (.04,2.0,.03), paint, side)
    for y in [.05,2.0]:
        box('OpenCasementRail', (.235,y,0), (.39,.05,.03), paint, side)
    box('OpenCasementMeetingRail', (.235,1.025,0), (.39,.04,.03), paint, side)
    for y in [.54,1.51]:
        box('OpenCasementGlazing', (.235,y,0), (.39,.93,.006), glass, side)
    box('FrenchWindowHandle', (.40,1.12,.025), (.014,.12,.025), brass, side)

asset.view_layers[0].update()
points = [obj.matrix_world @ Vector(corner) for obj in asset.objects for corner in obj.bound_box]
bounds = [min(p.x for p in points), min(p.z for p in points), min(-p.y for p in points),
          max(p.x for p in points), max(p.z for p in points), max(-p.y for p in points)]
# Assert whole mesh envelopes remain outside the corridor, not merely sampled vertices.
for obj in asset.objects:
    if obj.name.startswith('FrenchFrameHeader'):
        assert min(v.co.z for v in obj.data.vertices) >= 2.05 - 1e-7
    else:
        xs = [v.co.x for v in obj.data.vertices]
        assert max(xs) <= -.45 + 1e-7 or min(xs) >= .45 - 1e-7, obj.name
size = [bounds[3]-bounds[0], bounds[4]-bounds[1], bounds[5]-bounds[2]]
shared['export_static'](asset, OUT/'exit-window.glb', size, expected_bounds=bounds)
bpy.data.libraries.write(str(OUT/'exit-window.blend'), {asset}, fake_user=True, compress=True)
(OUT/'envelope.json').write_text(json.dumps({'bounds':bounds,'clearOpening':[.9,2.05],'outwardSwingDegrees':110},indent=2)+'\n')
print('Exported unobstructed French exit window', bounds)
