"""Original snake-plant shape study; adds scenes without changing existing assets.
The closed planter matches the diagnostic solid. Foliage is an unintegrated
appearance proposal, not a new collision contract.
"""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi
import bpy, bmesh, json

OUT = Path(__file__).resolve().parent
authoring = run_path(str(OUT.parent / 'authoring.py'))
export_static = authoring['export_static']
EVIDENCE = OUT.parents[2] / 'specs/done/help-the-fly-escape/assets/evidence/21/plant-refined'
EVIDENCE.mkdir(parents=True, exist_ok=True)
asset = bpy.data.scenes.new('Plant-Metres')
asset.unit_settings.system = 'METRIC'
asset.unit_settings.scale_length = 1
neutral = bpy.data.materials.new('Plant-Neutral-ShapeOnly')
neutral.use_nodes = True
neutral.diffuse_color = (0.5,0.5,0.5,1)
bsdf = neutral.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.5,0.5,0.5,1)
bsdf.inputs['Roughness'].default_value = 0.65
parts = []
topology = []

def mesh_part(name, vertices, faces, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert all(edge.is_manifold for edge in bm.edges), name
    assert all(face.calc_area()>1e-12 for face in bm.faces), name
    assert bm.calc_volume(signed=True)>0, name
    topology.append({'part':name,'vertices':len(bm.verts),'faces':len(bm.faces),
                     'closedManifold':True,'signedVolumeM3':bm.calc_volume(signed=True)})
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(neutral)
    for polygon in mesh.polygons: polygon.use_smooth = smooth
    obj = bpy.data.objects.new(name,mesh)
    asset.collection.objects.link(obj)
    obj['authorship'] = 'Original procedural Blender geometry; no downloaded assets'
    obj['shape_preparation_only'] = True
    parts.append(obj)
    return obj

# Keep the full square floor outline; only the upper planter corners soften.
# The shallow collar/reveal breaks the box silhouette without adding feet.
verts = []
ring_profile = [(.15,0,0),(.15,0,.344),(.148,0,.348),(.148,.009,.355),
                (.15,.012,.359),(.15,.012,.396),(.146,.010,.4),
                (.134,.009,.4),(.131,.007,.396),(.131,.007,.378)]
for extent,radius,z in ring_profile:
    for corner in range(4):
        angle=corner*pi/2
        cx=cos(angle+pi/4)*(extent-radius)*2**.5
        cy=sin(angle+pi/4)*(extent-radius)*2**.5
        for j in range(5):
            theta=angle+j*pi/8
            verts.append((cx+radius*cos(theta),cy+radius*sin(theta),z))
stride=20
faces = [tuple(reversed(range(stride))),tuple(range((len(ring_profile)-1)*stride,len(verts)))]
for layer in range(len(ring_profile)-1):
    for i in range(stride):
        j=(i+1)%stride
        faces.append((layer*stride+i,layer*stride+j,(layer+1)*stride+j,(layer+1)*stride+i))
mesh_part('ClosedSquarePlanter',verts,faces)

# Individual closed leaves have curved centre lines, cupped cross-sections and
# real thickness; no alpha cards. Deliberate uneven lengths avoid a radial fan.
for i,(angle,length,lean,width) in enumerate([
    (0,0.673,0.025,0.040),(0.85,0.42,0.047,0.040),
    (1.9,0.55,0.031,0.041),(2.8,0.32,0.055,0.038),
    (3.7,0.60,0.027,0.039),(4.65,0.38,0.048,0.040),
    (5.6,0.47,0.040,0.041)]):
    vertices=[]
    rows,cols=32,8
    for side in [-1,1]:
        for r in range(rows+1):
            t=r/rows
            radius=.060 + lean*(t*t*(3-2*t))+.016*sin(pi*t)
            sweep=0.011*sin(pi*t)*(-1 if i%2 else 1)
            twist=angle+(.45 if i%2 else -.4)*sin(pi*t)+.15*((i%3)-1)
            breadth=width*1.7*(0.52+0.48*sin(pi*t)**0.65)*(1-t**8)
            for c in range(cols+1):
                u=2*c/cols-1
                across=u*breadth/2
                cup=(u*u-0.5)*breadth*0.18
                vertices.append((cos(angle)*radius-sin(angle)*sweep+cos(twist)*(cup+side*0.001*(1-t)**.65)-sin(twist)*across,
                    sin(angle)*radius+cos(angle)*sweep+sin(twist)*(cup+side*0.001*(1-t)**.65)+cos(twist)*across,
                    0.377+length*(t-.065*sin(pi*t))))
    faces=[]
    stride=(rows+1)*(cols+1)
    for side in range(2):
        for r in range(rows):
            for c in range(cols):
                a=side*stride+r*(cols+1)+c
                face=(a,a+1,a+cols+2,a+cols+1)
                faces.append(face if side else tuple(reversed(face)))
    edge=list(range(cols+1))+[r*(cols+1)+cols for r in range(1,rows+1)]+list(range(rows*(cols+1)+cols-1,rows*(cols+1)-1,-1))+[r*(cols+1) for r in range(rows-1,0,-1)]
    for a,b in zip(edge,edge[1:]+edge[:1]): faces.append((a,b,b+stride,a+stride))
    mesh_part(f'Leaf{i+1:02}',vertices,faces,True)

# This proposal is deliberately not added to the production furniture catalog.
size = [0.3,1.05,0.3]
bounds = export_static(asset, OUT/'plant.glb',size)
(EVIDENCE/'roundtrip.json').write_text(json.dumps({'visualEnvelopeMetres':size,'bounds':bounds,'physicalPlanterMetres':[0.3,0.4,0.3],'integration':'not adopted'},indent=2)+'\n')
(EVIDENCE/'authored-topology.json').write_text(json.dumps(topology,indent=2)+'\n')
preview = authoring['neutral_stage']('Plant', parts, neutral, ortho_scale=1.8, ground_extent=200)
authoring['render_views'](preview, EVIDENCE, target=(0,0,0.525), views=[
    ('three-quarter',(1.8,-2.8,1.8)),('front',(0,-3,1.4)),('rear',(-1.8,2.8,1.8))])
bpy.data.libraries.write(str(OUT/'plant.blend'), {asset,preview}, fake_user=True, compress=True)
print('Prepared plant:', len(parts), 'parts; separate asset and neutral stage scenes preserved')
