"""Run in Blender's Python console with __file__ set to this file's path.
Rebuilds geometry in an isolated scene; writes that scene to fly.blend and fly.glb.
The checked-in .blend additionally contains a neutral review camera and lights.
Blender -Y forward converts to glTF +Z; one unit is one game world unit.
"""
import bpy
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
scene = bpy.data.scenes.new('FlyAuthoring')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
root = bpy.data.objects.new('FlyRoot', None)
scene.collection.objects.link(root)
root['up'] = '+Y (glTF)'
root['forward'] = '+Z (glTF)'
root['world_units_per_blender_unit'] = 1.0
root['ground_contact_description'] = 'ground contact, centered beneath thorax'


def material(name, color, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Alpha'].default_value = color[3]
    if color[3] < 1:
        mat.surface_render_method = 'BLENDED'
        mat.use_transparency_overlap = False
    return mat

shell = material('Chitin', (0.035, 0.052, 0.055, 1), 0.39, 0.12)
eye = material('CompoundEye', (0.30, 0.075, 0.055, 1), 0.32)
wing = material('WingMembrane', (0.32, 0.46, 0.50, 0.60), 0.35)
wing.use_backface_culling = False


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = root
    return obj


def ellipsoid(name, position, scale, mat=shell, icosphere=False):
    if icosphere:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=position)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=position)
    obj = finish(bpy.context.object, name, mat)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def rod(name, start, end, radius, mat=shell):
    a, b = Vector(start), Vector(end)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=radius, radius2=radius*0.68,
                                  depth=(b-a).length, location=(a+b)/2)
    obj = finish(bpy.context.object, name, mat)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj

ellipsoid('Thorax', (0, 0, 0.40), (0.17, 0.22, 0.18))
ellipsoid('AbdomenBase', (0, 0.21, 0.35), (0.17, 0.20, 0.145))
ellipsoid('AbdomenMiddle', (0, 0.33, 0.335), (0.155, 0.16, 0.13))
ellipsoid('AbdomenTip', (0, 0.435, 0.32), (0.115, 0.14, 0.10))
ellipsoid('Head', (0, -0.245, 0.415), (0.155, 0.145, 0.14))
for sign, side in [(-1, 'L'), (1, 'R')]:
    ellipsoid('Eye.'+side, (sign*0.115, -0.293, 0.445), (0.095, 0.12, 0.12), eye, icosphere=True)
    rod('Antenna.'+side, (sign*0.042,-0.365,0.46), (sign*0.065,-0.455,0.48), 0.012)
    ellipsoid('AntennaTip.'+side, (sign*0.065,-0.455,0.48), (0.017,0.025,0.017))
    for index, (attach_y,knee_y,toe_y) in enumerate([(-0.13,-0.22,-0.36),(0,-0.015,0.055),(0.14,0.25,0.43)]):
        attach=(sign*0.12,attach_y,0.35)
        knee=(sign*(0.26+0.025*index),knee_y,0.22)
        ankle=(sign*(0.32+0.025*index),toe_y,0.027)
        toe=(sign*(0.38+0.025*index),toe_y-0.055,0.009)
        rod(f'Leg{index+1}Upper.{side}',attach,knee,0.023)
        rod(f'Leg{index+1}Lower.{side}',knee,ankle,0.016)
        rod(f'Leg{index+1}Foot.{side}',ankle,toe,0.010)
    # A curved broad membrane with a raised center; tip trails the thorax.
    outline=[(0.11,-0.055,0.535),(0.29,-0.025,0.56),(0.51,0.105,0.58),
             (0.62,0.28,0.565),(0.60,0.43,0.545),(0.51,0.49,0.535),
             (0.36,0.415,0.535),(0.205,0.255,0.53),(0.105,0.095,0.53)]
    points=[(sign*x,y,z) for x,y,z in outline]
    points.append((sign*0.32,0.23,0.565))
    faces=[(9,i,(i+1)%9) for i in range(9)]
    mesh=bpy.data.meshes.new('Wing.'+side)
    mesh.from_pydata(points,[],faces)
    mesh.update()
    obj=bpy.data.objects.new('Wing.'+side,mesh)
    scene.collection.objects.link(obj)
    finish(obj,obj.name,wing)
    # Fine structural veins stay in the same material budget.
    for i, end in enumerate([points[2],points[3],points[5],points[6]]):
        rod(f'WingVein{i}.{side}',points[0],end,0.003, shell)
rod('Proboscis',(0,-0.35,0.34),(0,-0.395,0.29),0.023)

# Normalize the lowest actual vertex, not nominal primitive centers, to the floor.
meshes=[o for o in scene.objects if o.type=='MESH']
minimum=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
for obj in meshes:
    obj.location.z-=minimum
# Native GLB units are metres; measure body landmarks rather than the wider wing envelope.
bpy.context.view_layer.update()
body_vertices = [(o.matrix_world @ v.co).y for o in meshes
                 if o.name.startswith(("Head", "Thorax", "Abdomen")) for v in o.data.vertices]
body_length = max(body_vertices) - min(body_vertices)
root.scale = (0.003 / body_length,) * 3
root["body_length_metres"] = 0.003
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active=root
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'fly.glb'), export_format='GLB',
    use_selection=True, use_active_scene=True, export_yup=True, export_animations=False, export_extras=True)
bpy.data.libraries.write(str(OUT/'fly.blend'), {scene}, fake_user=True, compress=True)
print('Authored',len(meshes),'meshes; floor correction',minimum)
