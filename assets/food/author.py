# Run through Blender MCP. Separate source scenes preserve unrelated Blender work.
import bpy, math, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def material(name, color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(*color,1); bsdf.inputs['Roughness'].default_value=.8
    return m

def mesh(name, verts, faces, mat):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(obj); obj.data.materials.append(mat)
    return obj

def scene(name):
    s=bpy.data.scenes.new(name); bpy.context.window.scene=s; return s

def save(s, kind):
    for obj in s.objects: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/(kind+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
    bpy.data.libraries.write(str(ROOT/(kind+'.blend')),{s},fake_user=True)

s=scene('Food-Crumbs')
inside=material('food.crumbs.interior',(.67,.39,.105)); crust=material('food.crumbs.crust',(.29,.12,.03))
for k,(x,y,r) in enumerate([(-.55,-.25,.22),(-.05,-.4,.25),(.45,-.2,.23),(-.3,.25,.27),(.3,.36,.22),(.03,.04,.18),(-.67,.4,.10),(.7,.4,.1),(.17,.78,.1)]):
    sides=5+k%3; outline=[(x+r*math.cos(i*2*math.pi/sides),y+r*math.sin(i*2*math.pi/sides)) for i in range(sides)]
    verts=[(u,v,0) for u,v in outline]+[(x+(u-x)*.62,y+(v-y)*.62,.004) for u,v in outline]+[(x+.02,y-.03,.005)]
    faces=[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]+[(sides+i,sides+(i+1)%sides,2*sides) for i in range(sides)]
    obj=mesh('Crumb%02d'%k,verts,faces,inside); obj.data.materials.append(crust)
    for face in obj.data.polygons[:sides]: face.material_index=1
save(s,'crumbs')
print(json.dumps({'saved':str(ROOT),'scenes':['Food-Crumbs']}))
