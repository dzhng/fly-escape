"""Author a closed household window in native metres, with isolated neutral staging."""
from pathlib import Path
from runpy import run_path
import bpy, bmesh, json

OUT = Path(__file__).resolve().parent
shared = run_path(str(OUT.parent / 'authoring.py'))
proposal = json.loads((OUT.parents[1] / 'proportions/scale.json').read_text())['visualOnly']['window']
width, height, depth = (proposal[key] for key in ('width', 'height', 'depth'))
EVIDENCE = OUT.parents[2] / 'specs/help-the-fly-escape/assets/evidence/21/window-prepared'
EVIDENCE.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('Window-Metres')
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
neutral = bpy.data.materials.new('Window-Neutral-Shape')
neutral.use_nodes = True
neutral.diffuse_color = (.5, .5, .5, 1)
shader = neutral.node_tree.nodes['Principled BSDF']
shader.inputs['Base Color'].default_value = neutral.diffuse_color
shader.inputs['Roughness'].default_value = .65
parts = []

def box(name, center, size, bevel=.001):
    mesh = bmesh.new()
    bmesh.ops.create_cube(mesh, size=1)
    for vertex in mesh.verts:
        x, y, z = vertex.co
        vertex.co = (center[0]+x*size[0], -center[2]+y*size[2], center[1]+z*size[1])
    if bevel:
        bmesh.ops.bevel(mesh, geom=list(mesh.edges), offset=bevel, segments=3, affect='EDGES')
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    assert all(edge.is_manifold for edge in mesh.edges), name
    assert mesh.calc_volume(signed=True) > 0, name
    data = bpy.data.meshes.new(name)
    mesh.to_mesh(data)
    mesh.free()
    data.materials.append(neutral)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    parts.append(obj)

# The local origin is the sill bottom; installation height belongs to room placement.
rail = .06
box('Sill', (0, .02, 0), (width, .04, depth), .0015)
box('Head', (0, height-rail/2, -.01), (width, rail, depth-.02))
for side in (-1, 1):
    box('Jamb', (side*(width-rail)/2, (height+.04-rail)/2, -.01),
        (rail, height-.04-rail, depth-.02))
box('MeetingPost', (0, (height+.04-rail)/2, -.01), (.045, height-.04-rail, depth-.02))
# Rebates back the sash clearance, so a closed assembly has no through slit.
box('LowerRebate', (0, .055, -.02), (width-2*rail, .03, .032))
box('UpperRebate', (0, height-rail-.015, -.02), (width-2*rail, .03, .032))

# Separate closed panes/sashes preserve real reveals.
opening = (width-2*rail-.045)/2
for side in (-1, 1):
    center = side*(.045+opening)/2
    bottom, top, stile = .055, height-rail-.012, .028
    pane_height = top-bottom
    box('GlassPane', (center, (bottom+top)/2, -.006),
        (opening-.045, pane_height-.045, .006), .0003)
    for edge in (-1, 1):
        box('SashStile', (center+edge*(opening-stile)/2, (bottom+top)/2, .004),
            (stile, pane_height, .024))
        box('SashRail', (center, bottom+stile/2 if edge<0 else top-stile/2, .004),
            (opening-2*stile, stile, .024))

# A single operable sash gives the front an asymmetric handle for orientation checks.
box('HandleRose', (.065, .50, .021), (.022, .055, .008), .003)
box('HandleNeck', (.065, .50, .027), (.010, .015, .012), .002)
box('HandleLever', (.065, .455, .034), (.013, .105, .012), .004)

size = [width, height, depth]
run_path(str(OUT.parent / 'finish-details.py'))['apply_materials']('window', parts)
bounds = shared['export_static'](scene, OUT/'window.glb', size)
(EVIDENCE/'roundtrip.json').write_text(json.dumps({'envelopeMetres':size,
    'bounds':bounds, 'placement':'bottom-centred local sill; unregistered'}, indent=2)+'\n')
preview = shared['neutral_stage']('Window', parts, neutral, ortho_scale=1.9, ground_extent=200)
shared['render_views'](preview, EVIDENCE, target=(0,0,height/2), views=[
    ('three-quarter',(1.8,-2.8,1.6)), ('front',(0,-3,.7)), ('rear',(-1.8,2.8,1.6))])
bpy.data.libraries.write(str(OUT/'window.blend'), {scene,preview}, fake_user=True, compress=True)
print('Prepared neutral window', len(parts), 'parts', bounds)
