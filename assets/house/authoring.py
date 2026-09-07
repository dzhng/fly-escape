"""Native house-asset export and neutral staging; asset sources own geometry/framing."""
import bpy
from mathutils import Vector

def validate_envelope(objects, size, expected_bounds=None):
    # Blender is Z-up; compare to the catalog's GLB XYZ dimensions in metres.
    corners = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == 'MESH' for corner in obj.bound_box]
    bounds = [min(p.x for p in corners), min(p.z for p in corners), min(-p.y for p in corners),
              max(p.x for p in corners), max(p.z for p in corners), max(-p.y for p in corners)]
    expected = expected_bounds if expected_bounds is not None else [-size[0]/2, 0, -size[2]/2, size[0]/2, size[1], size[2]/2]
    if any(abs(actual-wanted) > 1e-6 for actual, wanted in zip(bounds, expected)):
        raise ValueError(f'Authored/exported envelope {bounds} differs from catalog {expected}; re-author, never stretch')
    return bounds

def export_static(scene, path, size, *, expected_bounds=None):
    scene.view_layers[0].update()
    validate_envelope(scene.objects, size, expected_bounds)
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB',
            use_active_scene=True, use_selection=False, export_yup=True,
            export_animations=False, export_extras=True)
    # Reader verification uses an isolated scene; no authoring-stage objects enter it.
    roundtrip = bpy.data.scenes.new('House-ExportValidation')
    try:
        with bpy.context.temp_override(scene=roundtrip, view_layer=roundtrip.view_layers[0], collection=roundtrip.collection):
            bpy.ops.import_scene.gltf(filepath=str(path))
        roundtrip.view_layers[0].update()
        return validate_envelope(roundtrip.objects, size, expected_bounds)
    finally:
        materials = set()
        for obj in list(roundtrip.objects):
            mesh = obj.data if obj.type == 'MESH' else None
            if mesh:
                materials.update(mesh.materials)
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh and mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for material in materials:
            if material.users == 0:
                bpy.data.materials.remove(material)
        bpy.data.scenes.remove(roundtrip)

def neutral_stage(name, parts, neutral, *, ortho_scale, ground_extent):
    """Shared white-light staging; framing stays with each authored asset."""
    preview = bpy.data.scenes.new(name+'-Neutral-AuthoringStage')
    for obj in parts: preview.collection.objects.link(obj)
    preview.render.engine = 'CYCLES'
    preview.cycles.device = 'CPU'
    preview.cycles.samples = 32
    preview.cycles.use_denoising = True
    preview.render.resolution_x = 1200
    preview.render.resolution_y = 900
    preview.render.resolution_percentage = 100
    preview.world = bpy.data.worlds.new(name+'-Neutral-World')
    preview.world.use_nodes = True
    preview.world.node_tree.nodes['Background'].inputs[0].default_value = (0.3,0.3,0.3,1)
    preview.world.node_tree.nodes['Background'].inputs[1].default_value = 0.5
    preview.view_settings.view_transform = 'AgX'
    light = bpy.data.lights.new(name+'-White-Area', 'AREA')
    light.energy = 450
    light.shape = 'DISK'
    light.size = 3
    lamp = bpy.data.objects.new(light.name, light)
    preview.collection.objects.link(lamp)
    lamp.location = (-2,-3,4)
    lamp.rotation_euler = (Vector((0,0,0.4))-lamp.location).to_track_quat('-Z','Y').to_euler()
    mesh = bpy.data.meshes.new('AuthoringGround')
    mesh.from_pydata([(-ground_extent,-ground_extent,-0.001),(ground_extent,-ground_extent,-0.001),(ground_extent,ground_extent,-0.001),(-ground_extent,ground_extent,-0.001)],[],[(0,1,2,3)])
    ground = bpy.data.objects.new('AuthoringGround',mesh)
    preview.collection.objects.link(ground)
    mesh.materials.append(neutral)
    camera_data = bpy.data.cameras.new(name+'-MeasurementCamera')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = ortho_scale
    camera = bpy.data.objects.new(camera_data.name,camera_data)
    preview.collection.objects.link(camera)
    preview.camera = camera
    return preview

def render_views(preview, directory, *, target, views):
    for name, position in views:
        preview.camera.location = position
        preview.camera.rotation_euler = (Vector(target)-preview.camera.location).to_track_quat('-Z','Y').to_euler()
        preview.render.filepath = str(directory/(name+'.png'))
        bpy.ops.render.render(write_still=True, scene=preview.name)
