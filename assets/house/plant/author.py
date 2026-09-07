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
EVIDENCE = OUT.parents[2] / 'specs/help-the-fly-escape/assets/evidence/21/plant-prepared'
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

def mesh_part(name, vertices, faces, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
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

# Full floor rectangle with no feet or tapered base: no apparent passable gap.
# Top opening is a shallow recess, contained inside the same closed solid.
verts = []
for extent,z in [(0.15,0),(0.15,0.4),(0.133,0.4),(0.133,0.378)]:
    verts.extend([(x*extent,y*extent,z) for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]])
faces = [(3,2,1,0),(12,13,14,15)]
for layer in range(3):
    for i in range(4):
        j=(i+1)%4
        faces.append((layer*4+i,layer*4+j,(layer+1)*4+j,(layer+1)*4+i))
mesh_part('ClosedSquarePlanter',verts,faces)

# Individual closed leaves have curved centre lines, cupped cross-sections and
# real thickness; no alpha cards. Deliberate uneven lengths avoid a radial fan.
for i,(angle,length,lean,width) in enumerate([
    (0,0.67,0.012,0.035),(2.0,0.59,0.035,0.039),
    (4.2,0.56,0.043,0.032),(0.8,0.47,0.076,0.038),
    (2.7,0.44,0.072,0.035),(4.8,0.40,0.074,0.035),
    (1.6,0.34,0.085,0.033),(3.6,0.30,0.093,0.034),
    (5.7,0.28,0.087,0.031)]):
    vertices=[]
    rows,cols=20,6
    for side in [-1,1]:
        for r in range(rows+1):
            t=r/rows
            radius=0.018 + (i%3)*0.009 + lean*sin(t*pi/2)
            breadth=width*1.7*(0.28+0.72*sin(pi*t)**0.65)*(1-t**8)
            for c in range(cols+1):
                u=2*c/cols-1
                across=u*breadth/2
                cup=(u*u-0.5)*breadth*0.14
                vertices.append((cos(angle)*(radius+cup+side*0.0007*(1-t))-sin(angle)*across,
                    sin(angle)*(radius+cup+side*0.0007*(1-t))+cos(angle)*across,
                    0.38+length*t))
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
preview = authoring['neutral_stage']('Plant', parts, neutral, ortho_scale=1.8, ground_extent=200)
authoring['render_views'](preview, EVIDENCE, target=(0,0,0.525), views=[
    ('three-quarter',(1.8,-2.8,1.8)),('front',(0,-3,1.4)),('rear',(-1.8,2.8,1.8))])
bpy.data.libraries.write(str(OUT/'plant.blend'), {asset,preview}, fake_user=True, compress=True)
print('Prepared plant:', len(parts), 'parts; separate asset and neutral stage scenes preserved')
