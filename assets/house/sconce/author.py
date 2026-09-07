"""Neutral household wall sconce; separate native asset and staging scenes."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi
import bpy, bmesh, json
from mathutils import Vector

OUT=Path(__file__).resolve().parent
shared=run_path(str(OUT.parent/'authoring.py'))
EVIDENCE=OUT.parents[2]/'specs/help-the-fly-escape/assets/evidence/21/sconce-prepared'
EVIDENCE.mkdir(parents=True,exist_ok=True)
asset=bpy.data.scenes.new('Sconce-Metres')
asset.unit_settings.system='METRIC'
asset.unit_settings.scale_length=1
neutral=bpy.data.materials.new('Sconce-Neutral-ShapeOnly')
neutral.use_nodes=True
neutral.diffuse_color=(.5,.5,.5,1)
neutral.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.5,.5,.5,1)
neutral.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.65
parts=[]
topology=[]

def finish(name,bm,smooth=False):
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:
        bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    assert all(e.is_manifold for e in bm.edges),(name,"manifold")
    assert all(f.calc_area()>1e-12 for f in bm.faces),(name,"area",min(f.calc_area() for f in bm.faces))
    assert bm.calc_volume(signed=True)>0,(name,"volume",bm.calc_volume(signed=True))
    topology.append({'part':name,'vertices':len(bm.verts),'faces':len(bm.faces),
                     'closedManifold':True,'signedVolumeM3':bm.calc_volume(signed=True)})
    mesh=bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(neutral)
    for face in mesh.polygons:face.use_smooth=smooth
    obj=bpy.data.objects.new(name,mesh)
    asset.collection.objects.link(obj)
    obj['authorship']='Original procedural Blender geometry; no downloaded assets'
    obj['shape_preparation_only']=True
    parts.append(obj)
    return obj

# Baked bevelled backplate; its rear surface defines the mounting plane.
bm=bmesh.new()
bmesh.ops.create_cube(bm,size=1)
for v in bm.verts:v.co=(v.co.x*.078,.073+v.co.y*.014,.10+v.co.z*.20)
bmesh.ops.bevel(bm,geom=list(bm.edges),offset=.004,segments=4,affect='EDGES')
finish('MountingBackplate',bm)

def rod(name,a,b,radius):
    a,b=Vector(a),Vector(b)
    bm=bmesh.new()
    bmesh.ops.create_cone(bm,cap_ends=True,segments=24,radius1=radius,radius2=radius,depth=(b-a).length)
    rotation=(b-a).to_track_quat('Z','Y').to_matrix()
    for v in bm.verts:v.co=rotation@v.co+(a+b)/2
    return finish(name,bm,True)

# A single closed bent tube connects wall plate and socket, with no seam gap.
path=[(.073,.10)]+[(.015+.025*cos(-pi/2-j*pi/32),.125+.025*sin(-pi/2-j*pi/32)) for j in range(17)]+[(-.01,.195)]
vertices=[]
for j,(y,z) in enumerate(path):
    previous=Vector(path[max(0,j-1)])
    following=Vector(path[min(len(path)-1,j+1)])
    tangent=(following-previous).normalized()
    for i in range(24):
        angle=2*pi*i/24
        vertices.append((.0055*cos(angle),y-.0055*tangent.y*sin(angle),z+.0055*tangent.x*sin(angle)))
faces=[tuple(reversed(range(24))),tuple(range((len(path)-1)*24,len(path)*24))]
for j in range(len(path)-1):
    for i in range(24):faces.append((j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i))
mesh=bpy.data.meshes.new('ArmSkin')
mesh.from_pydata(vertices,[],faces)
bm=bmesh.new();bm.from_mesh(mesh);bpy.data.meshes.remove(mesh)
finish('CurvedSupportArm',bm,True)
rod('BulbSocket',(0,-.01,.178),(0,-.01,.206),.012)
rod('BackplateLowerFastener',(0,.068,.034),(0,.061,.034),.004)
rod('BackplateUpperFastener',(0,.068,.175),(0,.061,.175),.004)
rod('SmallSwitch',(.023,.068,.063),(.023,.059,.063),.005)

# A thin closed shell keeps both openings and the folded edge bands visible.
profile=[(.108,.068,.18),(.11,.07,.182),(.109,.069,.186),
         (.071,.051,.314),(.071,.051,.318),(.069,.049,.32),
         (.065,.045,.32),(.066,.046,.316),(.104,.064,.184),(.104,.064,.18)]
vertices=[]
for rx,ry,z in profile:
    for i in range(64):
        angle=2*pi*i/64
        vertices.append((rx*cos(angle),-.01+ry*sin(angle),z))
faces=[]
for j in range(len(profile)):
    following=(j+1)%len(profile)
    for i in range(64):faces.append((j*64+i,j*64+(i+1)%64,following*64+(i+1)%64,following*64+i))
mesh=bpy.data.meshes.new('ShadeSkin')
mesh.from_pydata(vertices,[],faces)
bm=bmesh.new();bm.from_mesh(mesh);bpy.data.meshes.remove(mesh)
finish('BoundEdgeShade',bm,True)
for i,angle in enumerate([0,2.15,4.25]):
    rod(f'ShadeSupport{i+1}',(0,-.01,.19),(.106*cos(angle),-.01+.066*sin(angle),.19),.0022)
bm=bmesh.new()
bmesh.ops.create_uvsphere(bm,u_segments=32,v_segments=20,radius=1)
for v in bm.verts:v.co=(v.co.x*.024,-.01+v.co.y*.024,.232+v.co.z*.034)
finish('UnlitBulb',bm,True)
size=[.22,.32,.16]
run_path(str(OUT.parent / 'finish-details.py'))['apply_materials']('sconce', parts)
bounds=shared['export_static'](asset,OUT/'sconce.glb',size)
(EVIDENCE/'roundtrip.json').write_text(json.dumps({'sizeMetres':size,'bounds':bounds,'parts':topology,'runtimeAdoption':False},indent=2)+'\n')
preview=shared['neutral_stage']('Sconce',parts,neutral,ortho_scale=.49,ground_extent=200)
shared['render_views'](preview,EVIDENCE,target=(0,0,.16),views=[
    ('three-quarter',(.5,-.7,.39)),('front',(0,-.8,.20)),('rear',(-.45,.7,.34))])
# Supplemental underside inspection omits the ground that otherwise occludes it.
ground=next(o for o in preview.objects if o.name.startswith('AuthoringGround'))
ground.hide_render=True
shared['render_views'](preview,EVIDENCE,target=(0,0,.16),views=[
    ('underside',(.4,-.7,-.25))])
ground.hide_render=False
bpy.data.libraries.write(str(OUT/'sconce.blend'),{asset,preview},fake_user=True,compress=True)
print('Prepared sconce:',len(parts),'closed parts;',bounds)
