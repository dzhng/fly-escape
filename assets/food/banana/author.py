"""Original closed banana skin in metres; preserves existing Blender scenes."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi
import bpy, bmesh, json

OUT = Path(__file__).resolve().parent
shared = run_path(str(OUT.parents[1] / 'house/authoring.py'))
EVIDENCE = OUT.parents[2] / 'specs/help-the-fly-escape/assets/evidence/21/banana-refined'
EVIDENCE.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('Banana-Metres')
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
neutral = bpy.data.materials.new('Banana-Neutral-ShapeOnly')
neutral.use_nodes = True
neutral.diffuse_color = (0.5,0.5,0.5,1)
neutral.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5,0.5,0.5,1)
neutral.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.65

# A swept bent skin with subdued longitudinal ribs, a narrow stalk at +X,
# and a short blossom tip at -X. End poles close the surface without cap seams.
profile = [(0,0),(.008,.003),(.025,.004),(.045,.004),(.11,.0125),(.20,.018),
           (.30,.020),(.48,.0205),(.65,.020),(.76,.017),(.82,.0127),
           (.87,.008),(.92,.0052),(.975,.0045),(.992,.0038),(1,0)]
# Monotone cubic radii avoid artificial collars between profile samples.
secants=[(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(profile,profile[1:])]
slopes=[secants[0]]+[0 if a*b<=0 else 2*a*b/(a+b) for a,b in zip(secants,secants[1:])]+[secants[-1]]
rings = 120
segments = 40
vertices = []
for j in range(rings+1):
    t = j/rings
    for k in range(len(profile)-1):
        a,ra = profile[k]
        b,rb = profile[k+1]
        if a <= t <= b:
            u = (t-a)/(b-a)
            radius = ((2*u**3-3*u*u+1)*ra+(u**3-2*u*u+u)*(b-a)*slopes[k]
                      +(-2*u**3+3*u*u)*rb+(u**3-u*u)*(b-a)*slopes[k+1])
            break
    angle = -1.0 + 2.0*t
    cx,cy = .13*sin(angle), .13*cos(angle)
    stalk = max(0,(t-.86)/.14)
    cz = .004*stalk*stalk*(3-2*stalk)
    if j in (0,rings):
        vertices.append((cx,cy,cz))
    else:
        for i in range(segments):
            phi = 2*pi*i/segments
            ribbed = radius*(1+.045*cos(5*phi))
            vertices.append((cx+sin(angle)*ribbed*cos(phi),
                             cy+cos(angle)*ribbed*cos(phi), cz+ribbed*sin(phi)))
faces = []
for i in range(segments): faces.append((0,1+(i+1)%segments,1+i))
for j in range(rings-2):
    for i in range(segments):
        a=1+j*segments+i
        b=1+j*segments+(i+1)%segments
        faces.extend([(a,b,b+segments),(a,b+segments,a+segments)])
last=1+(rings-2)*segments
for i in range(segments): faces.append((last+i,last+(i+1)%segments,len(vertices)-1))
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
for polygon in mesh.polygons: polygon.use_smooth=True
mesh.materials.append(neutral)
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
    ('three-quarter',(.28,-.40,.35)),('top',(0,0,.6)),('end',(.45,-.25,.24))])
bpy.data.libraries.write(str(OUT/'banana.blend'),{scene,preview},fake_user=True,compress=True)
print('Prepared banana',size,'metres;',len(faces),'triangles')
