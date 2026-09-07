# Execute through Blender MCP with KIND set to the single contract being authored.
import bpy, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def material(name, color):
    m=bpy.data.materials.new('tool.'+name); m.diffuse_color=(*color,1); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*color,1); b.inputs['Roughness'].default_value=.75
    return m

def mesh(name, pts, faces, mat):
    d=bpy.data.meshes.new(name); d.from_pydata(pts,[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat); return o

def plate(name, outline, height, mat):
    n=len(outline); pts=[(x,y,z) for z in [0,height] for x,y in outline]
    return mesh(name,pts,[tuple(range(n,2*n)),tuple(reversed(range(n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)

def rect(name,x1,y1,x2,y2,h,mat): return plate(name,[(x1,y1),(x2,y1),(x2,y2),(x1,y2)],h,mat)

s=bpy.data.scenes.new('Tool-'+KIND.title()); bpy.context.window.scene=s
if KIND=='lamp':
    housing=material('lamp.housing',(.14,.19,.21)); trim=material('lamp.trim',(.45,.51,.50)); lens=material('lamp.lens',(.85,.89,.82)); screw=material('lamp.fastener',(.065,.09,.10))
    rect('SquareHousing',-.67,-.67,.67,.67,.002,housing)
    rect('MetalBezel',-.59,-.59,.59,.59,.003,trim)
    rect('PaleLens',-.46,-.46,.46,.46,.004,lens)
    for i,(x,y) in enumerate([(-.54,-.54),(-.54,.54),(.54,-.54),(.54,.54)]):
        rect('Fastener%d'%i,x-.035,y-.035,x+.035,y+.035,.0045,screw)
        rect('ScrewSlot%d'%i,x-.026,y-.006,x+.026,y+.006,.005,trim)
elif KIND=='shade':
    frame=material('shade.frame',(.04,.065,.085)); dark=material('shade.slats',(.075,.12,.17)); light=material('shade.slatsAlternate',(.18,.25,.30)); rail=material('shade.rail',(.37,.44,.43))
    rect('ShadeFrame',-.67,-.67,.67,.67,.002,frame)
    for i in range(6):
        y=-.58+i*.2; rect('ShadeSlat%d'%i,-.58,y,.58,y+.15,.004,dark if i%2 else light)
    rect('LeftRail',-.61,-.60,-.57,.60,.005,rail); rect('RightRail',.57,-.60,.61,.60,.005,rail)
else: raise ValueError(KIND)
for o in s.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/(KIND+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
bpy.data.libraries.write(str(ROOT/(KIND+'.blend')),{s},fake_user=True)
print(json.dumps({'kind':KIND,'objects':len(s.objects),'path':str(ROOT)}))
