# Execute through Blender MCP with KIND set to the single contract being authored.
import bpy, math, json
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

def disk(name,r,h,mat,n=64):
    return plate(name,[(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n)) for i in range(n)],h,mat)

def arc(name,r,width,start,end,h,mat,n=32):
    pts=[((r+width/2)*math.cos(start+(end-start)*i/n),(r+width/2)*math.sin(start+(end-start)*i/n)) for i in range(n+1)]
    pts += [((r-width/2)*math.cos(start+(end-start)*i/n),(r-width/2)*math.sin(start+(end-start)*i/n)) for i in range(n,-1,-1)]
    return plate(name,pts,h,mat)

def rect(name,x1,y1,x2,y2,h,mat): return plate(name,[(x1,y1),(x2,y1),(x2,y2),(x1,y2)],h,mat)

s=bpy.data.scenes.new('Tool-'+KIND.title()); bpy.context.window.scene=s
if KIND=='vinegar':
    rim=material('vinegar.ceramic',(.30,.17,.30)); edge=material('vinegar.edge',(.70,.56,.63)); liquid=material('vinegar.liquid',(.22,.065,.02)); ripple=material('vinegar.ripple',(.74,.41,.16))
    disk('Saucer',.96,.002,rim); disk('Lip',.87,.003,edge); disk('AmberLiquid',.77,.004,liquid)
    for i in range(3): arc('SourRipple%d'%i,.22+i*.18,.045,.3,2.6,.005,ripple)
elif KIND=='fan':
    rim=material('fan.housing',(.09,.17,.18)); inset=material('fan.inset',(.025,.04,.045)); blade=material('fan.rotor',(.38,.52,.48)); grate=material('fan.grille',(.55,.64,.55)); arrow=material('fan.direction',(.84,.65,.23))
    disk('VentHousing',.97,.002,rim); disk('RotorWell',.83,.003,inset)
    for i in range(3):
        a=i*math.tau/3; outline=[(.14,0),(.33,-.16),(.69,-.12),(.7,.13),(.38,.26)]
        plate('RotorBlade%d'%i,[(x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a)) for x,y in outline],.004,blade)
    disk('RotorHub',.15,.005,grate,24)
    for y in [-.52,-.26,.26,.52]:
        x=math.sqrt(.78**2-y*y); rect('Grille',-x,y-.018,x,y+.018,.005,grate)
    # Blender +X stays glTF +X, the core heading-zero wind direction.
    plate('ForwardChevron',[(.70,-.18),(.92,0),(.70,.18),(.70,.075),(.55,.075),(.55,-.075),(.70,-.075)],.005,arrow)
elif KIND=='lamp':
    rim=material('lamp.trim',(.34,.23,.085)); lens=material('lamp.lens',(.83,.67,.30)); rib=material('lamp.radial',(.98,.91,.62)); centre=material('lamp.centre',(.98,.95,.80))
    disk('RecessedTrim',.96,.002,rim); disk('WarmLens',.84,.003,lens)
    for i in range(12):
        a=i*math.tau/12
        plate('LensRib%d'%i,[(r*math.cos(a+t),r*math.sin(a+t)) for r,t in [(.32,-.025),(.77,-.045),(.77,.045),(.32,.025)]],.004,rib)
    disk('LightCentre',.31,.005,centre,40)
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
