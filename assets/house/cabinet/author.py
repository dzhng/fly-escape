"""Author one metre-scale cabinet; preserve all existing Blender scenes/assets.
GLB +Y up, +Z front, grounded origin at footprint centre. No production materials.
"""
from pathlib import Path
from runpy import run_path
import bpy, bmesh, json
from mathutils import Vector

OUT = Path(__file__).resolve().parent
authoring = run_path(str(OUT.parent / 'authoring.py'))
export_static = authoring['export_static']
EVIDENCE = OUT.parents[2] / 'specs/done/help-the-fly-escape/assets/evidence/21/cabinet-prepared'
OUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)
catalog_size = json.loads((OUT.parent / 'catalog.json').read_text())['cabinet']
asset = bpy.data.scenes.new('Cabinet-ClosedBase-Metres')
asset.unit_settings.system = 'METRIC'
asset.unit_settings.scale_length = 1
neutral = bpy.data.materials.new('Cabinet-Neutral-ShapeOnly')
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
    edges = list(bm.edges)
    if top_only:
        top = center[1] + size[1] / 2
        edges = [e for e in edges if all(abs(v.co.z - top) < 1e-6 for v in e.verts)]
    if bevel:
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=4, affect='EDGES')
    return finish(name, bm)

def rod(name, start, end, radius=0.005):
    a = Vector((start[0], -start[2], start[1]))
    b = Vector((end[0], -end[2], end[1]))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20,
                         radius1=radius, radius2=radius, depth=(b-a).length)
    matrix = (b-a).to_track_quat('Z', 'Y').to_matrix()
    for vertex in bm.verts:
        vertex.co = matrix @ vertex.co + (a+b)/2
    obj = finish(name, bm)
    for poly in obj.data.polygons:
        if len(poly.vertices) == 4: poly.use_smooth = True
    return obj

# Full rectangular floor contact: the plinth has no legs or apparent under-cabinet route.
box('ClosedFloorPlinth', (0, 0.045, 0), (1.2, 0.09, 0.45), 0.002, top_only=True)
box('ClosedCarcass', (0, 0.445, -0.025), (1.18, 0.71, 0.40), 0.003)
box('Countertop', (0, 0.8325, 0), (1.2, 0.035, 0.45), 0.004)
# Shaker-style frames read as joinery in neutral light; wear/grain/color are deferred.
for side, cx in [('Left', -0.291), ('Right', 0.291)]:
    width, height, y, rail = 0.574, 0.572, 0.388, 0.052
    box(side+'DoorPanel', (cx, y, 0.184), (width-0.006, height-0.006, 0.014), 0.002)
    box(side+'OuterStile', (cx-width/2+rail/2, y, 0.194), (rail, height, 0.012), 0.002)
    box(side+'InnerStile', (cx+width/2-rail/2, y, 0.194), (rail, height, 0.012), 0.002)
    for label, yy in [('BottomRail', y-height/2+rail/2), ('TopRail', y+height/2-rail/2)]:
        box(side+label, (cx, yy, 0.194), (width-2*rail, rail, 0.012), 0.002)
    hx = -0.065 if side == 'Left' else 0.065
    for yy in [0.482, 0.618]:
        rod(side+'HandleMount', (hx, yy, 0.200), (hx, yy, 0.220), 0.004)
    rod(side+'Handle', (hx, 0.475, 0.220), (hx, 0.625, 0.220))
box('WideDrawerFront', (0, 0.746, 0.190), (1.156, 0.124, 0.020), 0.002)
for xx in [-0.068, 0.068]:
    rod('DrawerHandleMount', (xx, 0.746, 0.200), (xx, 0.746, 0.220), 0.004)
rod('DrawerHandle', (-0.075, 0.746, 0.220), (0.075, 0.746, 0.220))

for obj in parts:
    obj['asset_key'] = 'cabinet-closed-base'
    obj['world_unit_metres'] = 1.0
    obj['authorship'] = 'Original procedural Blender geometry; no downloaded models/textures'
    obj['shape_preparation_only'] = True
print('cabinet export bounds:', export_static(asset, OUT/'cabinet.glb', catalog_size))

preview = authoring['neutral_stage']('Cabinet', parts, neutral, ortho_scale=1.72, ground_extent=20)
authoring['render_views'](preview, EVIDENCE, target=(0,0,0.425), views=[
    ('three-quarter',(1.8,-2.8,1.8)),('front',(0,-3,0.65)),('rear',(-1.8,2.8,1.8))])
bpy.data.libraries.write(str(OUT/'cabinet.blend'), {asset,preview}, fake_user=True, compress=True)
print('Prepared cabinet:', len(parts), 'parts; separate asset and neutral stage scenes preserved')
