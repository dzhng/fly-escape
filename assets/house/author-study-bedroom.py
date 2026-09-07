"""Native study and bedroom furnishings with closed grounded footprints and authored finishes."""
from pathlib import Path
from runpy import run_path
import bpy, bmesh, json

ROOT = Path(__file__).resolve().parent
shared = run_path(str(ROOT / 'authoring.py'))
material = run_path(str(ROOT / 'finish-details.py'))['material']
wood = material('Warm walnut joinery', '#765333', .56)
darkwood = material('Dark walnut plinth', '#443021', .68)
oak = material('Honey oak desktop', '#b99360', .58)
metal = material('Brass drawer handles', '#9a7547', .3, .7)
fabric = material('Ochre study upholstery', '#a68b58', .94)
linen = material('Cream cotton bed linen', '#e9dfca', .96)
duvet = material('Muted blue bed cover', '#66858a', .94)
pillow = material('Warm white pillows', '#f0e9d9', .96)
paper = material('Warm white writing paper', '#e8e1d1', .92)
book = material('Sage cloth notebook', '#5d7150', .94)
black = material('Charcoal laptop case', '#333936', .54)
screen = material('Quiet laptop display', '#596f78', .38)
catalog = json.loads((ROOT / 'catalog.json').read_text())


def make_scene(key):
    scene = bpy.data.scenes.new(key.title() + '-Native-Metres')
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    return scene


def box(scene, name, center, size, finish, bevel=.003, top_only=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = (center[0] + v.co.x * size[0], -center[2] + v.co.y * size[2], center[1] + v.co.z * size[1])
    edges = list(bm.edges)
    if top_only:
        top = center[1] + size[1] / 2
        edges = [edge for edge in edges if all(abs(v.co.z - top) < 1e-6 for v in edge.verts)]
    if bevel:
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=3, affect='EDGES')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(finish)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def save(scene, key):
    bounds = shared['export_static'](scene, ROOT / key / (key + '.glb'), catalog[key])
    bpy.data.libraries.write(str(ROOT / key / (key + '.blend')), {scene}, fake_user=True, compress=True)
    print('Exported', key, bounds)


# A closed-pedestal writing desk: drawers, generous work surface, notebook and open laptop.
# The continuous base deliberately offers no apparent traversable route beneath the catalog solid.
s = make_scene('desk')
box(s, 'DeskFloorPlinth', (0, .035, 0), (1.4, .07, .7), darkwood, .002, True)
box(s, 'ClosedDeskPedestal', (0, .39, -.018), (1.37, .66, .664), wood, .004)
box(s, 'OakWritingSurface', (0, .725, 0), (1.4, .05, .7), oak, .006)
for x in [-.46, 0, .46]:
    for y in [.19, .42, .635]:
        box(s, 'DeskDrawer', (x, y, .321), (.442, .205, .028), wood, .003)
        box(s, 'DeskHandle', (x, y + .045, .341), (.12, .018, .018), metal, .003)
box(s, 'LaptopBase', (-.20, .759, -.08), (.34, .018, .23), black, .004)
box(s, 'LaptopDisplayFrame', (-.20, .909, -.183), (.34, .282, .016), black, .004)
box(s, 'LaptopDisplay', (-.20, .909, -.1725), (.311, .248, .005), screen, .002)
box(s, 'ClothNotebook', (.31, .763, .08), (.23, .026, .30), book, .003)
box(s, 'NotebookPageBlock', (.31, .764, .079), (.218, .019, .285), paper, .002)
save(s, 'desk')

# A compact upholstered desk chair with a closed base, not an implied passage between legs.
s = make_scene('chair')
box(s, 'ChairFloorBase', (0, .035, 0), (.60, .07, .65), darkwood, .002, True)
box(s, 'ClosedUpholsteredChairBase', (0, .245, 0), (.58, .36, .63), fabric, .016)
box(s, 'ChairSeatCushion', (0, .46, .055), (.56, .105, .50), fabric, .022)
box(s, 'ChairBack', (0, .68, -.2575), (.60, .54, .135), fabric, .022)
for x in [-.26,.26]:
    box(s, 'ChairArm', (x, .59, .02), (.08, .28, .52), fabric, .015)
save(s, 'chair')

# Human-scale double bed: a closed platform fills the footprint; linen is layered above it.
s = make_scene('bed')
box(s, 'BedFloorPlinth', (0, .05, 0), (1.6, .10, 2.1), darkwood, .003, True)
box(s, 'BedPlatform', (0, .245, .005), (1.58, .30, 2.07), wood, .006)
box(s, 'BedHeadboard', (0, .575, -.9975), (1.6, .95, .105), wood, .008)
box(s, 'BedMattress', (0, .485, .025), (1.50, .20, 1.95), linen, .032)
box(s, 'BlueDuvet', (0, .597, .255), (1.50, .085, 1.49), duvet, .022)
box(s, 'DuvetFold', (0, .638, -.407), (1.49, .035, .18), linen, .011)
for x in [-.38,.38]:
    box(s, 'BedPillow', (x, .632, -.703), (.65, .105, .38), pillow, .038)
save(s, 'bed')
