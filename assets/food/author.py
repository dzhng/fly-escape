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

def band(name, inner, outer, height, mat, n=64):
    verts=[]
    for r,z in [(inner,0),(outer,0),(inner,height),(outer,height)]:
        verts += [(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z) for i in range(n)]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(2*n+i,3*n+i,3*n+j,2*n+j),(n+i,n+j,3*n+j,3*n+i),(i,2*n+i,2*n+j,j)])
    return mesh(name,verts,faces,mat)

def scene(name):
    s=bpy.data.scenes.new(name); bpy.context.window.scene=s; return s

def save(s, kind):
    for obj in s.objects: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/(kind+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
    bpy.data.libraries.write(str(ROOT/(kind+'.blend')),{s},fake_user=True)

s=scene('Food-Fruit')
rind=material('food.fruit.rind',(.58,.16,.015)); pith=material('food.fruit.pith',(.86,.68,.33))
a=material('food.fruit.flesh',(.93,.32,.025)); b=material('food.fruit.fleshAlternate',(.78,.20,.012))
band('OrangeRind',.91,1,.0035,rind); band('PithRing',.86,.92,.004,pith)
# Closed shallow segmented flesh wedges, separated by visible pith channels.
for k in range(9):
    start=k*2*math.pi/9+.035; end=(k+1)*2*math.pi/9-.035
    outline=[(.08*math.cos((start+end)/2),.08*math.sin((start+end)/2))]+[(.865*math.cos(start+(end-start)*j/7),.865*math.sin(start+(end-start)*j/7)) for j in range(8)]
    n=len(outline); verts=[(x,y,z) for z in [.0005,.0045] for x,y in outline]
    faces=[tuple(range(n,2*n)),tuple(reversed(range(n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh('JuiceSegment%02d'%k,verts,faces,a if k%2 else b)
band('Core',0,.09,.0045,pith,24)
# Three flattened seed shapes lie below the cut face ceiling.
for k in [1,4,7]:
    angle=(k+.5)*2*math.pi/9; x=.48*math.cos(angle); y=.48*math.sin(angle)
    pts=[]
    for i in range(12):
        t=i*2*math.pi/12; u=.025*math.cos(t); v=.075*math.sin(t)
        pts.append((x+u*math.cos(angle)-v*math.sin(angle),y+u*math.sin(angle)+v*math.cos(angle),.005))
    mesh('Seed%d'%k,pts,[tuple(range(12))],pith)
save(s,'fruit')

s=scene('Food-Crumbs')
inside=material('food.crumbs.interior',(.67,.39,.105)); crust=material('food.crumbs.crust',(.29,.12,.03))
for k,(x,y,r) in enumerate([(-.55,-.25,.22),(-.05,-.4,.25),(.45,-.2,.23),(-.3,.25,.27),(.3,.36,.22),(.03,.04,.18),(-.67,.4,.10),(.7,.4,.1),(.17,.78,.1)]):
    sides=5+k%3; outline=[(x+r*math.cos(i*2*math.pi/sides),y+r*math.sin(i*2*math.pi/sides)) for i in range(sides)]
    verts=[(u,v,0) for u,v in outline]+[(x+(u-x)*.62,y+(v-y)*.62,.004) for u,v in outline]+[(x+.02,y-.03,.005)]
    faces=[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]+[(sides+i,sides+(i+1)%sides,2*sides) for i in range(sides)]
    obj=mesh('Crumb%02d'%k,verts,faces,inside); obj.data.materials.append(crust)
    for face in obj.data.polygons[:sides]: face.material_index=1
save(s,'crumbs')
print(json.dumps({'saved':str(ROOT),'scenes':['Food-Fruit','Food-Crumbs']}))
