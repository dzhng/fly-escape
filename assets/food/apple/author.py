"""Edible-surface geometry and skin in metres; preserves other Blender scenes."""
from pathlib import Path
import bpy
import math

OUT = Path(__file__).resolve().parent
scene = bpy.data.scenes.new('Apple-Contact-Metres')
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
# Single poles avoid zero-area faces in the physical triangle export.
segments, rings = 40, 20
vertices = [(0, 0, 0.077)]
for j in range(1, rings):
    latitude = math.pi * j / rings
    height = 0.04 + 0.04 * math.cos(latitude) - 0.003 * math.exp(-(latitude / 0.3) ** 2)
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        radius = 0.04 * math.sin(latitude) * (1 + 0.035 * math.cos(5 * angle) * math.sin(latitude))
        vertices.append((radius * math.cos(angle), radius * math.sin(angle), height))
vertices.append((0, 0, 0))
faces = []
for i in range(segments):
    faces.append((0, 1 + i, 1 + (i + 1) % segments))
for j in range(rings - 2):
    for i in range(segments):
        a = 1 + j * segments + i
        b = 1 + j * segments + (i + 1) % segments
        faces.extend([(a, a + segments, b + segments), (a, b + segments, b)])
last = 1 + (rings - 2) * segments
bottom = len(vertices) - 1
for i in range(segments):
    faces.append((last + i, bottom, last + (i + 1) % segments))
mesh = bpy.data.meshes.new('Apple-Edible-Surface')
mesh.from_pydata(vertices, [], faces)
mesh.update()
for polygon in mesh.polygons:
    polygon.use_smooth = True
apple = bpy.data.objects.new('Apple', mesh)
scene.collection.objects.link(apple)
from runpy import run_path
run_path(str(OUT.parent/'skin.py'))['apply_skin'](mesh,'apple')
apple['asset_units'] = 'metres; grounded centre pivot; vertex-colour skin'

# No separate stem/leaf collider: this first contact asset is the edible body.
previous = bpy.context.window.scene
try:
    bpy.context.window.scene = scene
    bpy.ops.object.select_all(action='DESELECT')
    apple.select_set(True)
    bpy.context.view_layer.objects.active = apple
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'apple.glb'), export_format='GLB', use_active_scene=True,
                              export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    bpy.data.libraries.write(str(OUT / 'apple.blend'), {scene}, fake_user=True)
finally:
    bpy.context.window.scene = previous
print({'asset': str(OUT / 'apple.glb'), 'triangles': len(faces), 'skin_material': True})
