"""Original closed banana skin in metres; preserves existing Blender scenes."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi, sqrt
import bpy, bmesh, json

OUT = Path(__file__).resolve().parent
shared = run_path(str(OUT.parents[1] / 'house/authoring.py'))
EVIDENCE = OUT.parents[2] / 'specs/help-the-fly-escape/assets/evidence/21/banana-terminal'
EVIDENCE.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('Banana-Metres')
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
neutral = bpy.data.materials.new('Banana-Neutral-ShapeOnly')
neutral.use_nodes = True
neutral.diffuse_color = (0.5,0.5,0.5,1)
neutral.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5,0.5,0.5,1)
neutral.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.65

# The stalk is cut across a short round collar; the opposite smaller terminal
# has a shallow blossom scar. Both caps belong to the same closed skin.
profile = [(0,.0028),(.012,.0035),(.025,.004),(.045,.0048),(.11,.0125),(.20,.018),
           (.30,.020),(.48,.0205),(.65,.020),(.76,.017),(.82,.0127),
           (.87,.008),(.92,.0055),(.955,.0055),(.967,.0062),(.98,.0062),(.985,.0057)]
secants=[(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(profile,profile[1:])]
slopes=[secants[0]]+[0 if a*b<=0 else 2*a*b/(a+b) for a,b in zip(secants,secants[1:])]+[secants[-1]]
segments = 40
vertices = []
frames = []

def section(phi,t,radius):
    stalk_shape=min(1,max(0,(t-.88)/.08))
    scar_shape=max(0,1-t/.03)
    ribs=.045*(1-min(1,max(0,(t-.80)/.12)))
    uneven=1+ribs*cos(5*phi)+stalk_shape*(.10*cos(3*phi+.4)+.035*sin(5*phi)) + scar_shape*.12*cos(5*phi+.7)
    return (radius*uneven*cos(phi)*(1+.08*stalk_shape),
            radius*uneven*sin(phi)*(1-.16*stalk_shape))

samples = [.01]+[j/120 for j in range(2,119)]+[.985]
for t in samples:
    for k in range(len(profile)-1):
        a,ra = profile[k]
        b,rb = profile[k+1]
        if a <= t <= b:
            u = (t-a)/(b-a)
            radius = ((2*u**3-3*u*u+1)*ra+(u**3-2*u*u+u)*(b-a)*slopes[k]
                      +(-2*u**3+3*u*u)*rb+(u**3-u*u)*(b-a)*slopes[k+1])
            break
    angle = -1.0 + 2.0*t
    stalk = max(0,(t-.86)/.125)
    cz = .004*stalk*stalk*(3-2*stalk)
    dz = .004*6*stalk*(1-stalk)/.125 if t>.86 else 0
    length = sqrt(.26**2+dz**2)
    centre = (.13*sin(angle),.13*cos(angle),cz)
    normal = (sin(angle),cos(angle),0)
    binormal = (-dz*cos(angle)/length,dz*sin(angle)/length,.26/length)
    tangent = (.26*cos(angle)/length,-.26*sin(angle)/length,dz/length)
    frames.append((centre,normal,binormal,tangent))
    for i in range(segments):
        phi = 2*pi*i/segments
        across,up=section(phi,t,radius)
        cut=0
        if t==samples[-1]: cut=.00035*sin(3*phi+.5)+.00015*cos(7*phi)
        if t==samples[0]: cut=.00025*sin(5*phi+.7)
        vertices.append(tuple(centre[k]+across*normal[k]+up*binormal[k]+cut*tangent[k] for k in range(3)))
faces = []
for j in range(len(samples)-1):
    for i in range(segments):
        a=j*segments+i
        b=j*segments+(i+1)%segments
        faces.extend([(a,b,b+segments),(a,b+segments,a+segments)])
cap_faces = []
for end,depth,inner_radius in [(0,.00065,.0017),(-1,-.00015,.0048)]:
    centre,normal,binormal,tangent=frames[end]
    outer = 0 if end==0 else (len(samples)-1)*segments
    inner = len(vertices)
    inset = tuple(centre[k]+depth*tangent[k] for k in range(3))
    for i in range(segments):
        phi=2*pi*i/segments
        across,up=section(phi,samples[end],inner_radius)
        if end==0:
            across*=1+.25*cos(5*phi+.7)
            up*=1+.25*cos(5*phi+.7)
        cut=0 if end==-1 else .0001*sin(5*phi)
        vertices.append(tuple(inset[k]+across*normal[k]+up*binormal[k]+cut*tangent[k] for k in range(3)))
    pole=len(vertices)
    vertices.append(inset)
    for i in range(segments):
        nxt=(i+1)%segments
        faces.extend([(outer+i,outer+nxt,inner+nxt),(outer+i,inner+nxt,inner+i)])
        cap_faces.append(len(faces))
        faces.append((inner+i,inner+nxt,pole))
mins=[min(p[k] for p in vertices) for k in range(3)]
maxs=[max(p[k] for p in vertices) for k in range(3)]
vertices=[(x-(mins[0]+maxs[0])/2,y-(mins[1]+maxs[1])/2,z-mins[2]) for x,y,z in vertices]
mesh=bpy.data.meshes.new('Banana-ClosedSkin')
mesh.from_pydata(vertices,[],faces)
mesh.update()
bm=bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
assert all(e.is_manifold for e in bm.edges)
assert all(f.calc_area()>1e-12 for f in bm.faces)
volume=bm.calc_volume(signed=True)
assert volume>0
bm.to_mesh(mesh)
bm.free()
for polygon in mesh.polygons: polygon.use_smooth=polygon.index not in cap_faces
run_path(str(OUT.parent/'skin.py'))['apply_skin'](mesh,'banana')
banana=bpy.data.objects.new('Banana',mesh)
scene.collection.objects.link(banana)
banana['authorship']='Original procedural Blender geometry; no downloaded assets'
banana['shape_preparation_only']=True
size=[maxs[0]-mins[0],maxs[2]-mins[2],maxs[1]-mins[1]]
bounds=shared['export_static'](scene,OUT/'banana.glb',size)
(EVIDENCE/'roundtrip.json').write_text(json.dumps({'sizeMetres':size,'roundtripBounds':bounds,
    'vertices':len(vertices),'triangles':len(faces),'closedManifold':True,'signedVolumeM3':volume,
    'runtimeAdoption':False},indent=2)+'\n')
preview=shared['neutral_stage']('Banana',[banana],neutral,ortho_scale=.34,ground_extent=200)
shared['render_views'](preview,EVIDENCE,target=(0,0,.02),views=[
    ('three-quarter',(.28,-.40,.35)),('top',(0,0,.6)),('end',(.45,-.25,.24)),('blossom',(-.45,-.25,.24))])
bpy.data.libraries.write(str(OUT/'banana.blend'),{scene,preview},fake_user=True,compress=True)
print('Prepared banana',size,'metres;',len(faces),'triangles')
