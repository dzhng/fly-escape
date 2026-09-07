"""Household props in native metres, portable mesh detail and solid PBR materials."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi
import bpy, bmesh, json, random
from mathutils import Vector
ROOT = Path(__file__).resolve().parent
shared = run_path(str(ROOT.parent/'house/authoring.py'))
material = run_path(str(ROOT.parent/'house/finish-details.py'))['material']


def mesh(name, vertices, faces, finish):
    data=bpy.data.meshes.new(name); data.from_pydata(vertices,[],faces); data.update()
    data.materials.append(finish)
    obj=bpy.data.objects.new(name,data); SCENE.collection.objects.link(obj)
    return obj


def ellipsoid(name, center, radius, finish, segments=20, rings=12):
    bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=segments,v_segments=rings,radius=1)
    for v in bm.verts: v.co=Vector(center)+Vector((v.co.x*radius[0],v.co.y*radius[1],v.co.z*radius[2]))
    data=bpy.data.meshes.new(name); bm.to_mesh(data); bm.free(); data.materials.append(finish)
    obj=bpy.data.objects.new(name,data); SCENE.collection.objects.link(obj)
    for p in data.polygons: p.use_smooth=True
    return obj


def box(name, center, size, finish, bevel=.003):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1)
    for v in bm.verts: v.co=Vector(center)+Vector((v.co.x*size[0],v.co.y*size[1],v.co.z*size[2]))
    if bevel: bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bevel,segments=2,affect='EDGES')
    data=bpy.data.meshes.new(name); bm.to_mesh(data); bm.free(); data.materials.append(finish)
    obj=bpy.data.objects.new(name,data); SCENE.collection.objects.link(obj); return obj


def tube(name, points, radius, finish, sides=6):
    verts=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize(); ref=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0))
        u=tangent.cross(ref).normalized(); v=tangent.cross(u).normalized()
        verts.extend([Vector(p)+radius*(cos(j*2*pi/sides)*u+sin(j*2*pi/sides)*v) for j in range(sides)])
    faces=[tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))]
    for i in range(len(points)-1):
        for j in range(sides): faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    obj=mesh(name,verts,faces,finish)
    for p in obj.data.polygons:p.use_smooth=True
    return obj


def ring(name, center, radius, thickness, finish, scale=(1,1)):
    return tube(name,[(center[0]+radius*cos(i*2*pi/32)*scale[0],center[1]+radius*sin(i*2*pi/32)*scale[1],center[2]) for i in range(33)],thickness,finish)


def shoes():
    leather=material('Worn tobacco leather','#74503a',.88); sole=material('Scuffed rubber','#494038',.94)
    lining=material('Dark shoe lining','#282622',1); lace=material('Cotton laces','#c5b99a',.95)
    for x,y in [(-.079,-.008),(.078,.008)]:
        ellipsoid('Rubber sole',(x,y,.017),(.066,.117,.017),sole)
        ellipsoid('Leather toe',(x,y-.041,.052),(.064,.073,.037),leather)
        # The upper is an open boot profile, not a solid sphere under a fake opening.
        profile=[(.058,.053,.038),(.057,.052,.075),(.050,.044,.13),(.043,.036,.15),(.037,.030,.15),(.036,.03,.108)]
        vertices=[(x+rx*cos(i*2*pi/24),y+.055+ry*sin(i*2*pi/24),z) for rx,ry,z in profile for i in range(24)]
        faces=[(j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i) for j in range(len(profile)-1) for i in range(24)]
        upper=mesh('Open leather upper',vertices,faces,leather)
        for p in upper.data.polygons:p.use_smooth=True
        ellipsoid('Open ankle lining',(x,y+.055,.109),(.036,.03,.004),lining)
        ring('Stitched ankle collar',(x,y+.055,.147),.04,.003,leather,(1.03,.83))
        for j in range(5):
            yy=y-.027+j*.015
            tube('Crossed lace',[(x-.029,yy,.087),(x+.026,yy+.015,.098)],.0022,lace)
            tube('Crossed lace',[(x+.029,yy,.087),(x-.026,yy+.015,.098)],.0022,lace)
        tube('Toe stitching',[(x+.052*cos(t*pi/12),y-.04-.06*sin(t*pi/12),.067) for t in range(13)],.0012,lace)


def dishes():
    ceramic=material('Aged cream glaze','#e5dcc5',.24); edge=material('Celadon rim','#718a7c',.3)
    sauce=material('Dried tomato sauce','#913e25',.9); crust=material('Bread crumbs','#b28b50',.95)
    for n in range(4):
        z=.008+n*.018; segments=40
        profile=[(.0,z),(.09,z),(.122,z+.014),(.139,z+.021),(.137,z+.027),(.12,z+.024),(.087,z+.01),(.0,z+.01)]
        verts=[(r*cos(j*2*pi/segments),r*sin(j*2*pi/segments),zz) for r,zz in profile for j in range(segments)]
        faces=[]
        for i in range(len(profile)-1):
            for j in range(segments):
                a,b,c,d=i*segments+j,i*segments+(j+1)%segments,(i+1)*segments+(j+1)%segments,(i+1)*segments+j
                if profile[i][0] == 0: faces.append((a,c,d))
                elif profile[i+1][0] == 0: faces.append((a,b,c))
                else: faces.append((a,b,c,d))
        mesh('Stacked shallow plate',verts,faces,ceramic); ring('Glazed rim',(0,0,z+.026),.137,.002,edge)
    ellipsoid('Dried sauce smear',(-.025,-.015,.073),(.063,.045,.0015),sauce)
    rng=random.Random(23)
    for i in range(8): ellipsoid('Food crumb',(rng.uniform(-.07,.07),rng.uniform(-.07,.07),.079),(.008,.006,.004),crust,8,6)
    # Small overturned bowl supplies an asymmetrical silhouette on the plate stack.
    ellipsoid('Overturned tea bowl',(.032,.04,.104),(.066,.062,.039),ceramic)
    ring('Bowl foot',(.032,.04,.14),.026,.004,edge)


def laundry():
    fabric=material('Dusty blue cotton','#687e89',1); warm=material('Faded clay linen','#b48672',1); seam=material('Cotton seam','#b9c2bd',1)
    for layer,(sx,sy,z,finish) in enumerate([(.28,.22,.01,fabric),(.23,.17,.072,warm)]):
        nx,ny=28,22; verts=[]
        for j in range(ny+1):
            for i in range(nx+1):
                x=(i/nx*2-1)*sx; y=(j/ny*2-1)*sy
                h=z+.10*(1-(x/sx)**2)* (1-(y/sy)**2)+.018*(1+sin(i*.68+j*.4+layer))*sin(pi*i/nx)*sin(pi*j/ny)
                verts.append((x+.009*sin(j*.8),y+.008*sin(i*.7),h))
        faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
        obj=mesh('Crumpled cotton garment',verts,faces,finish)
        for p in obj.data.polygons:p.use_smooth=True
        # Closed underside avoids a single-sided cloth silhouette when viewed from below.
        boundary=[verts[i] for i in range(nx+1)]+[verts[j*(nx+1)+nx] for j in range(1,ny+1)]+[verts[ny*(nx+1)+i] for i in range(nx-1,-1,-1)]+[verts[j*(nx+1)] for j in range(ny-1,0,-1)]
        count=len(boundary)
        underside=boundary+[(x,y,z-.002) for x,y,z in boundary]
        faces=[tuple(range(2*count-1,count-1,-1))]
        faces.extend((i,count+i,count+(i+1)%count,(i+1)%count) for i in range(count))
        mesh('Garment thickness',underside,faces,finish)
        tube('Rolled garment hem',boundary+[boundary[0]],.003,seam)
    ellipsoid('Rolled sock',(.18,-.13,.045),(.11,.047,.038),fabric)


def cat():
    fur=material('Ginger tabby fur','#b98555',.94); dark=material('Tabby stripes','#795438',1)
    cream=material('Cream muzzle and paws','#d5bb91',1); pink=material('Ear and nose leather','#aa746a',.9)
    ellipsoid('Curled sleeping body',(0,.025,.139),(.265,.178,.133),fur)
    ellipsoid('Resting head',(-.17,-.093,.164),(.102,.087,.083),fur)
    for x in [-.226,-.112]:
        mesh('Pointed ear',[(x-.026,-.10,.211),(x+.025,-.10,.218),(x,-.065,.30),(x,-.025,.225)],[(0,1,2),(1,3,2),(3,0,2),(0,3,1)],fur)
        mesh('Pink ear inset',[(x-.016,-.101,.224),(x+.016,-.101,.227),(x,-.072,.279)],[(0,1,2)],pink)
    for x in [-.205,-.145]:
        ellipsoid('Cream cheek',(x,-.166,.143),(.029,.023,.024),cream)
        tube('Closed sleeping eye',[(x-.015,-.165,.187),(x,-.174,.182),(x+.014,-.171,.187)],.002,dark)
    ellipsoid('Pink nose',(-.175,-.191,.15),(.011,.005,.006),pink,12,8)
    ellipsoid('Tucked forepaw',(-.085,-.13,.045),(.08,.046,.035),cream)
    tube('Curled tail',[(.23*cos(t),.017+.163*sin(t),.050) for t in [i*1.6*pi/32-.4 for i in range(33)]],.025,fur,12)
    ellipsoid('Rounded tail tip',(.23*cos(1.6*pi-.4),.017+.163*sin(1.6*pi-.4),.050),(.025,.025,.025),fur,16,8)
    for j in range(5):
        x=-.10+j*.066
        cross=(1-(x/.265)**2)**.5
        tube('Tabby back stripe',[(x,.025+.178*cross*sin(a),.139+.133*cross*cos(a)) for a in [-.8,-.6,-.4,-.2,0,.2,.4,.6,.8]],.0025,dark)


def zapper():
    frame=material('Warm charcoal appliance','#384240',.63,.18); tray=material('Brushed aged metal','#8b8b78',.4,.65)
    violet=material('UV tubes','#aa9dec',.3,emission='#8675ff')
    box('Weighted floor base',(0,0,.025),(.30,.28,.05),frame)
    for x in [-.13,.13]: box('Side housing',(x,0,.35),(.04,.20,.60),frame)
    box('Top housing',(0,0,.655),(.30,.22,.06),frame)
    box('Removable insect tray',(0,0,.084),(.25,.21,.045),tray)
    for x in [-.063,.063]: tube('UV lamp',[(x,0,.13),(x,0,.605)],.013,violet,12)
    for y in [-.101,.101]:
        for i in range(11):tube('Protective vertical grille',[(-.111+i*.0222,y,.12),(-.111+i*.0222,y,.62)],.0025,tray)
        for z in [.17,.29,.41,.53,.60]: tube('Grille crossbar',[(-.112,y,z),(.112,y,z)],.0025,frame)
    tube('Carry handle',[(-.067,0,.68),(-.06,0,.715),(.06,0,.715),(.067,0,.68)],.008,frame)
    box('Power switch',(.092,-.112,.655),(.023,.008,.013),violet,.001)


def spider():
    silk=material('Warm ivory spider silk','#c6c1ab',.85); body=material('House spider brown','#514132',.94)
    # Web lies in a vertical local XZ plane for mounting beside a wall.
    center=Vector((0,.025,.31)); count=12
    endpoints=[Vector((.247*cos(i*2*pi/count),.025+.025*sin(i*2*pi/count),.31+.289*sin(i*2*pi/count))) for i in range(count)]
    # Opposite spokes are one strand: no coincident capped faces at the hub.
    for i in range(count//2):tube('Radial web silk',[endpoints[i],center,endpoints[i+count//2]],.0009,silk,4)
    for n in range(1,7):
        pts=[center+(p-center)*(n/6) for p in endpoints]
        tube('Web capture spiral',pts+[pts[0]],.0007,silk,4)
    ellipsoid('Spider abdomen',(0,.006,.324),(.018,.016,.026),body,16,10)
    ellipsoid('Spider head',(0,-.005,.296),(.012,.011,.013),body,12,8)
    for side in [-1,1]:
        for j in range(4):
            tube('Articulated spider leg',[(side*.009,-.004,.294+j*.008),(side*(.036+j*.003),-.032,.266+j*.026),(side*(.048+j*.003),.021,.25+j*.036)],.002,body)

BUILDERS={'worn-shoes':shoes,'dirty-dishes':dishes,'crumpled-laundry':laundry,'sleeping-cat':cat,'bug-zapper':zapper,'corner-spider':spider}


def build(kind, evidence='/tmp/fly-household-evidence'):
    global SCENE
    SCENE=bpy.data.scenes.new('Household-'+kind+'-NativeMetres'); SCENE.unit_settings.system='METRIC'
    BUILDERS[kind]()
    SCENE.view_layers[0].update()
    points=[o.matrix_world@Vector(v) for o in SCENE.objects for v in o.bound_box]
    # Ground the authored mesh without rescaling or stretching its native proportions.
    floor=min(p.z for p in points)
    for obj in SCENE.objects:
        for v in obj.data.vertices:v.co.z-=floor
        obj.data.update()
    SCENE.view_layers[0].update()
    points=[o.matrix_world@Vector(v) for o in SCENE.objects for v in o.bound_box]
    bounds=[min(p.x for p in points),min(p.z for p in points),min(-p.y for p in points),max(p.x for p in points),max(p.z for p in points),max(-p.y for p in points)]
    size=[bounds[i+3]-bounds[i] for i in range(3)]
    triangles=0
    for o in SCENE.objects:o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
    assert triangles<=12000,(kind,triangles)
    out=ROOT/kind; out.mkdir(exist_ok=True)
    shared['export_static'](SCENE,out/(kind+'.glb'),size,expected_bounds=bounds)
    bpy.data.libraries.write(str(out/(kind+'.blend')),{SCENE},fake_user=True,compress=True)
    (out/'envelope.json').write_text(json.dumps({'units':'metres','upAxis':'Y','bounds':bounds,'size':size,'triangles':triangles,'source':'../author.py','collision':'none: integration owns behavior'},indent=2)+'\n')
    stage=shared['neutral_stage']('Household-'+kind,list(SCENE.objects),material('Neutral stone','#b7b1a4',1),ortho_scale=max(size)*1.65,ground_extent=2)
    stage.render.resolution_x=800; stage.render.resolution_y=700; stage.cycles.samples=16
    target=(0,0,size[1]*.48)
    folder=Path(evidence); folder.mkdir(exist_ok=True)
    stage.camera.location=(1,-1.6,1.1) if kind!='corner-spider' else (.8,-1.6,.8)
    stage.camera.rotation_euler=(Vector(target)-stage.camera.location).to_track_quat('-Z','Y').to_euler()
    stage.render.filepath=str(folder/(kind+'.png'))
    bpy.ops.render.render(write_still=True,scene=stage.name)
    return {'kind':kind,'bounds':bounds,'triangles':triangles}
