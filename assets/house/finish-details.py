"""Author portable window/sconce materials without changing native meshes or placements."""
from pathlib import Path
from runpy import run_path
import bpy

ROOT = Path(__file__).resolve().parent


def linear_color(hex_color):
    rgb = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)


def material(name, color, roughness, metallic=0, emission=None):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = (*linear_color(color), 1)
    shader = result.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = result.diffuse_color
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission:
        shader.inputs['Emission Color'].default_value = (*linear_color(emission), 1)
        shader.inputs['Emission Strength'].default_value = .8
    return result


def apply_materials(kind, objects):
    paint = material('Ivory window paint' if kind == 'window' else 'Parchment sconce shade',
                     '#eee4d2' if kind == 'window' else '#bda583', .75)
    metal = material('Warm brass detail', '#9a7547', .3, .7)
    accent = (material('Muted closed window glass', '#aec4c8', .2, .12)
              if kind == 'window' else material('Warm sconce bulb', '#fff0d0', .55, emission='#ffcb83'))
    for obj in objects:
        if obj.type != 'MESH':
            continue
        if kind == 'window':
            chosen = accent if obj.name.startswith('GlassPane') else metal if obj.name.startswith('Handle') else paint
        else:
            chosen = accent if obj.name.startswith('UnlitBulb') else paint if obj.name.startswith('BoundEdgeShade') else metal
        obj.data.materials.clear()
        obj.data.materials.append(chosen)


def finish_existing():
    export_static = run_path(str(ROOT / 'authoring.py'))['export_static']
    for kind, prefix, size in [('window', 'Window-Metres', [1.4, 1.1, .08]),
                               ('sconce', 'Sconce-Metres', [.22, .32, .16])]:
        path = ROOT / kind / (kind + '.blend')
        with bpy.data.libraries.load(str(path)) as (source, loaded):
            loaded.scenes = list(source.scenes)
        scenes = set(loaded.scenes)
        asset = next(scene for scene in scenes if scene.name.startswith(prefix))
        before = {obj.name: (len(obj.data.vertices), len(obj.data.polygons)) for obj in asset.objects if obj.type == 'MESH'}
        apply_materials(kind, asset.objects)
        assert before == {obj.name: (len(obj.data.vertices), len(obj.data.polygons)) for obj in asset.objects if obj.type == 'MESH'}
        bounds = export_static(asset, path.with_suffix('.glb'), size)
        bpy.data.libraries.write(str(path), scenes, fake_user=True, compress=True)
        print('Finished detail', kind, bounds)


if __name__ == '__main__':
    finish_existing()
