"""Native house-asset export; Blender and glTF round trips share catalog bounds."""
import bpy
from mathutils import Vector

def validate_envelope(objects, size):
    # Blender is Z-up; compare to the catalog's GLB XYZ dimensions in metres.
    corners = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == 'MESH' for corner in obj.bound_box]
    bounds = [min(p.x for p in corners), min(p.z for p in corners), min(-p.y for p in corners),
              max(p.x for p in corners), max(p.z for p in corners), max(-p.y for p in corners)]
    expected = [-size[0]/2, 0, -size[2]/2, size[0]/2, size[1], size[2]/2]
    if any(abs(actual-wanted) > 1e-6 for actual, wanted in zip(bounds, expected)):
        raise ValueError(f'Authored/exported envelope {bounds} differs from catalog {expected}; re-author, never stretch')
    return bounds

def export_static(scene, path, size):
    scene.view_layers[0].update()
    validate_envelope(scene.objects, size)
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
        return validate_envelope(roundtrip.objects, size)
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
