"""Apply portable production materials to the authored house kit without changing meshes."""
from pathlib import Path
import bpy
ROOT = Path(__file__).resolve().parent

def paint(name, rgb, roughness=.7, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    linear = [v / 12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    mat.diffuse_color = (*linear, 1)
    shader = mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return mat

wood = paint('Warm oak floor', (1,1,1), .65)
shader = wood.node_tree.nodes['Principled BSDF']
for channel, socket in [('Diffuse','Base Color'),('Rough','Roughness'),('nor_gl','Normal')]:
    node = wood.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(str(ROOT/'textures/wood-floor'/(channel+'.jpg')), check_existing=True)
    if channel != 'Diffuse': node.image.colorspace_settings.name = 'Non-Color'
    node.image.pack()
    if channel == 'nor_gl':
        normal = wood.node_tree.nodes.new('ShaderNodeNormalMap')
        wood.node_tree.links.new(node.outputs['Color'], normal.inputs['Color'])
        wood.node_tree.links.new(normal.outputs['Normal'], shader.inputs[socket])
    else: wood.node_tree.links.new(node.outputs['Color'], shader.inputs[socket])

plaster = paint('Warm ivory plaster', (.88,.85,.77), .9)
walnut = paint('Warm walnut cabinet', (.40,.27,.16), .55)
stone = paint('Cream stone countertop', (.76,.72,.62), .45)
metal = paint('Aged brass hardware', (.43,.35,.19), .32, .8)
fabric = paint('Sage woven upholstery', (.42,.49,.38), .92)
base = paint('Dark wood plinth', (.19,.14,.10), .65)

for key in ['floor','wall','solid','cabinet','sofa']:
    path = ROOT/(key+'.glb') if key in ['floor','wall','solid'] else ROOT/key/(key+'.glb')
    scene = bpy.data.scenes.new('Finished-'+key)
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0], collection=scene.collection):
        bpy.ops.import_scene.gltf(filepath=str(path))
        for obj in scene.objects:
            if obj.type != 'MESH': continue
            name = obj.name.lower()
            mat = wood if key=='floor' else plaster if key=='wall' else walnut
            if key=='cabinet': mat = metal if 'handle' in name else stone if 'countertop' in name else walnut
            if key=='sofa': mat = base if 'plinth' in name or 'base' in name else fabric
            obj.data.materials.clear(); obj.data.materials.append(mat)
            if key=='floor':
                uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
                for loop in obj.data.loops:
                    p = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
                    uv.data[loop.index].uv = (p.x/1.7, p.y/1.7)
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_active_scene=True,
                                  export_yup=True, export_animations=False, export_extras=True)
    bpy.data.libraries.write(str(path.with_suffix('.blend')), {scene}, fake_user=True, compress=True)
    print('Finished', key, path.stat().st_size)
