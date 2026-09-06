"""Shared sRGB palette for Blender-authored house surfaces and the browser renderer."""
import json
from pathlib import Path
import bpy


def house_material(role):
    surface = json.loads((Path(__file__).parent / 'palette.json').read_text())[role]
    rgb = [int(surface['color'][i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    material = bpy.data.materials.new('House-' + role)
    material.use_nodes = True
    material.diffuse_color = (*linear, 1)
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = material.diffuse_color
    shader.inputs['Roughness'].default_value = surface['roughness']
    return material
