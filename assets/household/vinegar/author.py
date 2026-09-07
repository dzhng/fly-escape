"""A household vinegar bottle with a broad food label; no miniature lettering."""
from pathlib import Path
from runpy import run_path
from math import sin, cos, pi
import bpy, json
H = run_path(str(Path(__file__).resolve().parents[1] / 'author.py'))


def bottle(name, profile, finishes, bands):
    segments=40
    vertices=[(radius*cos(i*2*pi/segments),radius*sin(i*2*pi/segments),z) for radius,z in profile for i in range(segments)]
    faces=[tuple(range(segments-1,-1,-1))]
    materials=[0]
    for j in range(len(profile)-1):
        for i in range(segments):
            faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
            materials.append(bands.get(j,0))
    faces.append(tuple((len(profile)-1)*segments+i for i in range(segments)));materials.append(0)
    obj=H['mesh'](name,vertices,faces,finishes[0])
    for material in finishes[1:]: obj.data.materials.append(material)
    for p,index in zip(obj.data.polygons,materials): p.material_index=index;p.use_smooth=len(p.vertices)==4


def author():
    material,ellipsoid,tube = (H[k] for k in ['material','ellipsoid','tube'])
    amber=material('Glossy amber vinegar bottle','#7d5830',.19)
    label=material('Warm paper food label','#e7dfc7',.82)
    green=material('Forest green label bands and cap','#4d6751',.5)
    red=material('Apple label symbol','#b25137',.8)
    leaf=material('Leaf label symbol','#758454',.8)
    bottle('Shouldered vinegar bottle',[(.026,0),(.033,.007),(.036,.021),(.036,.045),(.036,.050),(.036,.133),(.036,.140),(.036,.156),(.031,.174),(.015,.190),(.014,.202)], [amber,label,green],{3:2,4:1,5:2})
    bottle('Screw cap',[(.016,.197),(.0165,.201),(.0165,.218),(.0145,.223)],[green],{})
    for i in range(16):
        a=i*2*pi/16
        tube('Cap grip ridge',[(.0165*cos(a),.0165*sin(a),.202),(.0165*cos(a),.0165*sin(a),.216)],.0006,green,6)
    # A bold embossed apple mark remains recognizable without text at icon size.
    ellipsoid('Apple label left lobe',(.0362,-.006,.087),(.0017,.010,.013),red,16,10)
    ellipsoid('Apple label right lobe',(.0362,.006,.087),(.0017,.010,.013),red,16,10)
    ellipsoid('Apple leaf',(.0365,.006,.107),(.0015,.008,.004),leaf,12,8)


H['BUILDERS']['vinegar'] = author
result = H['build']('vinegar','/tmp/fly-fan-vinegar-evidence')
path=Path(__file__).resolve().parent/'envelope.json';data=json.loads(path.read_text())
data['source']='author.py'
data['footprintRadius']=max((x*x+z*z)**.5 for obj in H['build'].__globals__['SCENE'].objects for x,y,z in [(v.co.x,v.co.z,-v.co.y) for v in obj.data.vertices])
assert data['footprintRadius'] <= .2
path.write_text(json.dumps(data,indent=2)+'\n')
print(result)
