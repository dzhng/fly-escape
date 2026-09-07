"""Neutral scale probes only; writes a separate Blender scene and no existing assets."""
from pathlib import Path
import bpy, bmesh, json, math
from mathutils import Vector
OUT=Path(__file__).resolve().parent
spec=json.loads((OUT/'scale.json').read_text())
scene=bpy.data.scenes.new('Proportions-Neutral-Metres')
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
mat=bpy.data.materials.new('Proportions-Neutral')
mat.diffuse_color=(0.5,0.5,0.5,1)
mat.use_nodes=True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.5,0.5,0.5,1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=0.8
objects=[]
def mesh_object(name,verts,faces):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);mesh.materials.append(mat);objects.append(obj)
    return obj
def box(name,center,size):
    bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
    for v in bm.verts:
        v.co=Vector((center[0]+v.co.x*size[0],-center[2]+v.co.y*size[2],center[1]+v.co.z*size[1]))
    mesh=bpy.data.meshes.new(name);bm.to_mesh(mesh);bm.free();obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);mesh.materials.append(mat);objects.append(obj);return obj
box('Floor',(2,-0.04,2),(4,0.08,4))
a=spec['visualOnly']['apple'];r=a['diameter']/2
# A neutral slightly lobed apple volume, with a stem dimple; no surface detail.
verts=[];faces=[];rings=20;segments=40
for j in range(rings+1):
    t=math.pi*j/rings
    for i in range(segments):
        p=2*math.pi*i/segments;rad=r*math.sin(t)*(1+0.035*math.cos(5*p)*math.sin(t))
        h=r+r*math.cos(t)-0.003*math.exp(-(t/0.3)**2)
        verts.append((a['center']['x']+rad*math.cos(p),-a['center']['z']+rad*math.sin(p),h))
for j in range(rings):
    for i in range(segments):
        a0=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a0,b,b+segments,a0+segments))
obj=mesh_object('Apple80mm',verts,faces)
for p in obj.data.polygons:p.use_smooth=True
box('AppleStem',(a['center']['x'],0.080,a['center']['z']),(0.003,0.01,0.003))
b=spec['visualOnly']['banana'];verts=[];faces=[];steps=24;segments=12
for j in range(steps+1):
    t=j/steps;rad=b['diameter']/2*(0.15+0.85*math.sin(math.pi*t)**0.5)
    x=b['center']['x']+(t-0.5)*b['length'];z=b['center']['z']+0.035*math.sin(math.pi*t)
    for i in range(segments):
        p=i/segments*2*math.pi;verts.append((x,-z+rad*math.cos(p),0.015+rad*math.sin(p)))
for j in range(steps):
    for i in range(segments):
        a0=j*segments+i;bb=j*segments+(i+1)%segments;faces.append((a0,bb,bb+segments,a0+segments))
faces.extend([tuple(reversed(range(segments))),tuple(steps*segments+i for i in range(segments))])
obj=mesh_object('Banana180mm',verts,faces)
for p in obj.data.polygons:p.use_smooth=True
w=spec['visualOnly']['window'];x=w['centerX'];y=w['sillHeight'];width=w['width'];h=w['height']
for name,c,size in [
    ('WindowLeft',(x-width/2,y+h/2,0.10),(0.045,h,0.08)),
    ('WindowRight',(x+width/2,y+h/2,0.10),(0.045,h,0.08)),
    ('WindowTop',(x,y+h,0.10),(width+0.045,0.045,0.08)),
    ('WindowSill',(x,y,0.12),(width+0.09,0.06,0.16)),
    ('WindowMullion',(x,y+h/2,0.11),(0.025,h,0.04))]:box(name,c,size)
# This fixed fixture's two right-wall ends own the doorway span.
door_a=spec['geometry']['walls'][3]['b'];door_b=spec['geometry']['walls'][4]['a']
box('DoorLintel',(door_a['x'],(spec['doorHeight']+spec['wallHeight'])/2,(door_a['z']+door_b['z'])/2),(0.12,spec['wallHeight']-spec['doorHeight'],door_b['z']-door_a['z']))
# The existing single-room floor instance restores these normalized X/Z transforms.
# This diagnostic composite is not a valid production modular floor-kit replacement.
for obj in objects:
    for v in obj.data.vertices:v.co.x=(v.co.x-2)/4;v.co.y=(v.co.y+2)/4
    obj['diagnostic_only']=True
with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
    bpy.ops.export_scene.gltf(filepath=str(OUT/'neutral-floor.glb'),export_format='GLB',use_active_scene=True,export_yup=True,export_animations=False,export_extras=True)
bpy.data.libraries.write(str(OUT/'neutral-proportions.blend'),{scene},fake_user=True,compress=True)
print('Authored',scene.name,len(objects),'neutral composition objects; preserved existing scenes')
