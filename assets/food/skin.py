"""Offline fruit skin materials; geometry stays owned by each fruit author."""
import bpy
from math import sin, atan2, pi, cos

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


def author_banana_detail(banana, side_rings, segments):
    """Author a periodic peel-detail image; broad colour remains vertex-owned.

    A 32 mm tile keeps fly-scale spots resolved without a full-peel 4K atlas.
    Periodic distances make its borders continuous. Only ordinary glTF image,
    UV and vertex-colour multiplication ships; no procedural shader is exported.
    """
    import numpy as np
    mesh = banana.data
    uv = mesh.uv_layers.new(name='SkinUV')
    side_vertices = side_rings * segments
    for polygon in mesh.polygons:
        ids = [mesh.loops[i].vertex_index for i in polygon.loop_indices]
        seam = any(i % segments == 0 for i in ids) and any(i % segments == segments - 1 for i in ids)
        for loop_index, vertex in zip(polygon.loop_indices, ids):
            if vertex < side_vertices:
                around = vertex % segments
                if seam and around == 0: around = segments
                uv.data[loop_index].uv = (7 * (vertex // segments) / (side_rings - 1), 2 * around / segments)
            else:
                point = mesh.vertices[vertex].co
                uv.data[loop_index].uv = (point.y / .032, point.z / .032)
    size = 1024
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    rng = np.random.default_rng(731)
    pigment = np.zeros((size, size), dtype=np.float32)
    for _ in range(260):
        cx, cy = rng.random(2)
        rx = rng.uniform(.002, .0105)
        ry = rx * rng.uniform(.55, 1.6)
        dx, dy = (x-cx+.5)%1-.5, (y-cy+.5)%1-.5
        angle = rng.uniform(0, 2*pi)
        a, b = dx*cos(angle)+dy*sin(angle), -dx*sin(angle)+dy*cos(angle)
        distance = np.sqrt((a/rx)**2+(b/ry)**2)
        irregular = .07*np.sin(2*pi*(x*61+y*37)) + .04*np.sin(2*pi*(x*113-y*83))
        edge = np.clip((1.15-distance+irregular)/.55, 0, 1)
        spot = edge * (.35 + .65*np.exp(-distance*distance*1.8)) * rng.uniform(.35, .9)
        pigment = np.maximum(pigment, spot)
    grain = np.full((size, size), .975, dtype=np.float32)
    for _ in range(32):
        fx, fy = rng.integers(-180, 181, 2)
        grain += .0015*np.sin(2*pi*(x*fx+y*fy)+rng.uniform(0, 2*pi))
    pixels = np.ones((size, size, 4), dtype=np.float32)
    for channel, brown in enumerate((.23, .15, .45)):
        pixels[:,:,channel] = grain * (1-pigment*(1-brown))
    image = bpy.data.images.new('Banana-Peel-Detail', width=size, height=size, alpha=False)
    image.pixels.foreach_set(pixels.ravel())
    image.update()
    image.pack()
    material = mesh.materials[0]
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    attribute = next(node for node in nodes if node.type == 'VERTEX_COLOR')
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.extension = 'REPEAT'
    mixed = nodes.new('ShaderNodeMix')
    mixed.data_type = 'RGBA'
    mixed.blend_type = 'MULTIPLY'
    mixed.inputs[0].default_value = 1
    links.new(texture.outputs['Color'], mixed.inputs[6])
    links.new(attribute.outputs['Color'], mixed.inputs[7])
    links.new(mixed.outputs[2], bsdf.inputs['Base Color'])
