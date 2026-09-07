"""Deterministic vertex skin colours; geometry stays owned by each fruit author."""
import bpy
from math import sin, atan2

def apply_skin(mesh, kind):
    material=bpy.data.materials.new(kind.title()+'-Skin')
    material.use_nodes=True
    nodes=material.node_tree.nodes
    bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=0.38 if kind=='apple' else 0.58
    bsdf.inputs['Coat Weight'].default_value=0.18 if kind=='apple' else 0.03
    attribute=nodes.new('ShaderNodeVertexColor');attribute.layer_name='Skin'
    material.node_tree.links.new(attribute.outputs['Color'],bsdf.inputs['Base Color'])
    colour=mesh.color_attributes.get('Skin') or mesh.color_attributes.new(name='Skin',type='FLOAT_COLOR',domain='POINT')
    xs=[v.co.x for v in mesh.vertices];lo,hi=min(xs),max(xs)
    for v in mesh.vertices:
        x,y,z=v.co
        if kind=='apple':
            angle=atan2(y,x)
            stripe=(0.5+0.5*sin(angle*15+sin(z*95)*1.5))**5
            blush=0.5+0.5*sin(angle-0.6)
            gold=min(0.75,0.16*stripe+0.12*(1-blush))
            fleck=0.5+0.5*sin(x*4200+y*3100+z*2800)
            rgb=(0.42+0.16*gold+0.02*fleck,0.012+0.24*gold,0.009+0.025*gold)
        else:
            t=(x-lo)/(hi-lo)
            terminal=max(0.,min(1.,(0.055-t)/0.035)) if t<0.055 else max(0.,min(1.,(t-0.91)/0.055))
            variation=0.5+0.5*sin(x*290+y*520+z*210)
            yellow=(0.72+0.025*variation,0.46+0.025*variation,0.025+0.006*variation)
            brown=(0.10,0.043,0.012)
            rgb=tuple(a*(1-terminal)+b*terminal for a,b in zip(yellow,brown))
        colour.data[v.index].color=(*rgb,1)
    mesh.materials.clear();mesh.materials.append(material)
    return material
