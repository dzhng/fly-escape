"""A native closed-floor kitchen run: refrigerator, hob, recessed sink and cupboards."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi
import bpy, bmesh, json
from mathutils import Vector

OUT = Path(__file__).resolve().parent
shared = run_path(str(OUT.parent / 'authoring.py'))
material = run_path(str(OUT.parent / 'finish-details.py'))['material']
asset = bpy.data.scenes.new('Kitchen-Native-Metres')
asset.unit_settings.system = 'METRIC'
asset.unit_settings.scale_length = 1
wood = material('Walnut kitchen cupboards', '#765333', .58)
plinth = material('Dark kitchen plinth', '#45352a', .76)
stone = material('Warm stone kitchen counter', '#d2c7b2', .56)
fridge = material('Ivory refrigerator enamel', '#dfe2d9', .42, .08)
steel = material('Brushed kitchen steel', '#8c999b', .3, .55)
glass = material('Charcoal hob and oven glass', '#242d2f', .28, .12)
burner = material('Hob burner rings', '#a2a6a1', .4, .48)


def finish(name, bm, paint, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(paint)
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    asset.collection.objects.link(obj)
    return obj


def box(name, center, size, paint, bevel=.002, top_only=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = (center[0] + v.co.x * size[0], -center[2] + v.co.y * size[2], center[1] + v.co.z * size[1])
    edges = list(bm.edges)
    if top_only:
        edges = [edge for edge in edges if all(abs(v.co.z - center[1] - size[1]/2) < 1e-6 for v in edge.verts)]
    if bevel:
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=3, affect='EDGES')
    return finish(name, bm, paint)


def rod(name, start, end, radius, paint):
    a, b = [Vector((p[0], -p[2], p[1])) for p in [start, end]]
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=radius, radius2=radius, depth=(b-a).length)
    rotation = (b-a).to_track_quat('Z', 'Y').to_matrix()
    for v in bm.verts:
        v.co = rotation @ v.co + (a+b)/2
    return finish(name, bm, paint, True)


# Continuous floor contact agrees with the shared rectangular solid footprint.
box('ContinuousKitchenPlinth', (0, .04, 0), (2.4, .08, .65), plinth, .002, True)
box('TallRefrigerator', (-.875, 1.085, -.015), (.65, 2.03, .62), fridge, .006)
box('FridgeUpperDoor', (-.875, 1.4, .292), (.61, 1.31, .018), fridge, .007)
box('FridgeFreezerDoor', (-.875, .405, .292), (.61, .645, .018), fridge, .007)
box('FridgeUpperHandle', (-.625, 1.22, .316), (.026, .43, .018), steel, .004)
box('FridgeFreezerHandle', (-.625, .55, .316), (.026, .22, .018), steel, .004)
box('ClosedLowerCabinets', (.325, .4375, -.02), (1.75, .735, .61), wood, .003)
for z in [-.30,.26]:
    box('CounterSupportRail', (.325,.8325,z), (1.75,.055,.05), wood, .002)
for x in [-.525,1.175]:
    box('CounterSideSupport', (x,.8325,-.02), (.05,.055,.61), wood, .002)
for x in [-.26, .325, .91]:
    box('CupboardFront', (x, .463, .298), (.563, .756, .026), wood, .003)
    box('CupboardHandle', (x, .738, .319), (.16, .022, .012), steel, .003)
box('OvenGlassDoor', (-.26, .405, .313), (.48, .375, .012), glass, .009)
box('OvenHandle', (-.26, .615, .319), (.38, .022, .012), steel, .003)

# Countertop ends at 0.9m. The centre/right remains open above it, apart from the faucet.
box('CounterLeft', (-.075, .885, 0), (.95, .03, .65), stone, .002)
box('CounterRight', (1.085, .885, 0), (.23, .03, .65), stone, .002)
for z in [-.2525, .2525]:
    box('CounterSinkSurround', (.685, .885, z), (.57, .03, .145), stone, .002)
box('BlackCeramicHob', (-.15, .907, 0), (.48, .014, .44), glass, .005)
for x in [-.27, -.03]:
    for z in [-.105,.105]:
        vertices, faces = [], []
        for ring in range(48):
            a = ring * 2*pi/48
            for cross in range(8):
                t = cross * 2*pi/8
                radius = .062 + .0025*cos(t)
                vertices.append((x+radius*cos(a), -(z+radius*sin(a)), .916+.0025*sin(t)))
        for ring in range(48):
            for cross in range(8):
                faces.append((ring*8+cross, ((ring+1)%48)*8+cross, ((ring+1)%48)*8+(cross+1)%8, ring*8+(cross+1)%8))
        mesh = bpy.data.meshes.new('BurnerRing')
        mesh.from_pydata(vertices, [], faces)
        bm = bmesh.new(); bm.from_mesh(mesh); bpy.data.meshes.remove(mesh)
        finish('VisibleHobRing', bm, burner, True)

# A genuinely recessed basin, with an exposed bottom and closed metal sides.
box('SinkBottom', (.685, .825, 0), (.55, .02, .34), steel, .006)
for x in [.41,.96]:
    box('SinkSide', (x, .868, 0), (.02, .084, .36), steel, .003)
for z in [-.17,.17]:
    box('SinkEnd', (.685, .868, z), (.53, .084, .02), steel, .003)
for x in [.4025,.9675]:
    box('SinkRim', (x, .91, 0), (.025, .012, .39), steel, .003)
for z in [-.1875,.1875]:
    box('SinkRim', (.685, .91, z), (.54, .012, .025), steel, .003)
rod('SinkDrain', (.685,.835,0), (.685,.838,0), .018, glass)
rod('FaucetStem', (.685,.9,-.24), (.685,1.08,-.24), .012, steel)
path = [(.685, 1.08+.07*sin(i*pi/16), -.17-.07*cos(i*pi/16)) for i in range(17)]
for a,b in zip(path,path[1:]):
    rod('CurvedFaucet', a,b,.012,steel)
rod('FaucetSpout', path[-1], (.685,1.045,-.10), .012, steel)
rod('FaucetLever', (.74,.904,-.24), (.74,.96,-.24), .01, steel)

size = json.loads((OUT.parent / 'catalog.json').read_text())['kitchen']
shared['export_static'](asset, OUT/'kitchen.glb', size)
bpy.data.libraries.write(str(OUT/'kitchen.blend'), {asset}, fake_user=True, compress=True)
print('Exported native refrigerator/hob/sink kitchen run', size)
