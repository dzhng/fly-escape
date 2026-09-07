"""Static household fan; the front/blowing axis is native +X, never inferred from a camera."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi
import bpy, json
H = run_path(str(Path(__file__).resolve().parents[1] / 'author.py'))


def cage_ring(name, x, radius, wire, finish):
    # One periodic torus with no duplicate seam/cap triangles.
    vertices = []
    for i in range(48):
        a = i * 2*pi/48
        for j in range(6):
            b = j * 2*pi/6
            vertices.append((x+wire*sin(b), (radius+wire*cos(b))*cos(a), .278+(radius+wire*cos(b))*sin(a)))
    faces = [(i*6+j, ((i+1)%48)*6+j, ((i+1)%48)*6+(j+1)%6, i*6+(j+1)%6) for i in range(48) for j in range(6)]
    obj = H['mesh'](name, vertices, faces, finish)
    for face in obj.data.polygons: face.use_smooth = True


def author():
    material,box,ellipsoid,tube = (H[k] for k in ['material','box','ellipsoid','tube'])
    enamel=material('Muted sage fan enamel','#6a8179',.36,.12)
    guard=material('Warm brushed grille wire','#b0b3a4',.35,.7)
    blades=material('Champagne aluminum blades','#b59b71',.38,.58)
    dark=material('Rubber feet and controls','#323a35',.9)
    box('Weighted oval base',(0,0,.019),(.26,.22,.038),enamel,.016)
    for y in [-.073,.073]: box('Rubber foot',(0,y,.005),(.16,.025,.010),dark,.003)
    box('Tapered pedestal',(-.037,0,.116),(.049,.065,.18),enamel,.009)
    ellipsoid('Rear motor housing',(-.060,0,.278),(.064,.068,.068),enamel,24,16)
    # A physical axle, hub and pitched, closed blade solids sit inside the guard.
    tube('Motor axle',[(-.045,0,.278),(.055,0,.278)],.011,guard,12)
    for k in range(3):
        outline=[(.022,-.019),(.075,-.037),(.129,-.017),(.145,.012),(.133,.042),(.096,.058),(.042,.030)]
        a=k*2*pi/3; vertices=[]
        for offset in [-.002,.002]:
            for radial,across in outline:
                vertices.append((.012+across*.22+offset,radial*cos(a)-across*sin(a),.278+radial*sin(a)+across*cos(a)))
        count=len(outline)
        faces=[tuple(range(count-1,-1,-1)),tuple(range(count,2*count))]
        faces.extend((i,(i+1)%count,count+(i+1)%count,count+i) for i in range(count))
        H['mesh']('Pitched fan blade',vertices,faces,blades)
    ellipsoid('Central front hub',(.042,0,.278),(.020,.034,.034),enamel,24,12)
    for x,r in [(.050,.166),(.059,.118),(.064,.070),(-.039,.166)]: cage_ring('Circular safety grille',x,r,.0024,guard)
    for i in range(8):
        a=i*2*pi/8
        points=[(.064,r*cos(a),.278+r*sin(a)) for r in [.032,.070]]
        points.extend([(.059,.118*cos(a),.278+.118*sin(a)),(.050,.166*cos(a),.278+.166*sin(a))])
        tube('Front radial safety wire',points,.0017,guard)
        tube('Rear safety wire',[(-.067,.045*cos(a),.278+.045*sin(a)),(-.039,.166*cos(a),.278+.166*sin(a))],.0017,guard)
    for a in [0,pi]:
        tube('Guard housing bridge',[(-.039,.166*cos(a),.278+.166*sin(a)),(.050,.166*cos(a),.278+.166*sin(a))],.0035,enamel)
    box('Speed selector',(.065,-.036,.041),(.035,.034,.012),dark,.004)
    ellipsoid('Tilt pivot',(-.043,-.066,.251),(.021,.010,.021),guard,16,10)


H['BUILDERS']['fan'] = author
result = H['build']('fan', '/tmp/fly-fan-vinegar-evidence')
path=Path(__file__).resolve().parent/'envelope.json'
data=json.loads(path.read_text()); data['blowingDirection']=[1,0,0]
data['source']='author.py'
data['footprintRadius']=max((x*x+z*z)**.5 for obj in H['build'].__globals__['SCENE'].objects for x,y,z in [(v.co.x,v.co.z,-v.co.y) for v in obj.data.vertices])
assert data['footprintRadius'] <= .25
path.write_text(json.dumps(data,indent=2)+'\n')
print(result)
