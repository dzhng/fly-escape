"""Portable tile finish on the existing floor kit geometry, in an isolated scene."""
from pathlib import Path
import bpy, numpy as np
OUT=Path(__file__).resolve().parent
scene=bpy.data.scenes.new('Kitchen-Tile-Floor')
size=1024
y,x=np.mgrid[0:size,0:size].astype(np.float32)/size
# Four 40 cm tiles per image; approximately 3 mm warm-grey grout.
u,v=(x*4)%1,(y*4)%1
grout=np.clip((.009-np.minimum.reduce([u,1-u,v,1-v]))/.004,0,1)
rng=np.random.default_rng(810)
shade=rng.uniform(-.018,.018,(4,4))[np.minimum((y*4).astype(int),3),np.minimum((x*4).astype(int),3)]
cloud=np.zeros_like(x)
for _ in range(20):
 fx,fy=rng.integers(-20,21,2)
 cloud+=.0015*np.sin(2*np.pi*(x*fx+y*fy)+rng.uniform(0,2*np.pi))
pixels=np.ones((size,size,4),dtype=np.float32)
for channel,(stone,joint) in enumerate(zip((.64,.61,.54),(.36,.34,.29))):
 pixels[:,:,channel]=(stone+shade+cloud)*(1-grout)+joint*grout
image=bpy.data.images.new('Warm-Ceramic-Colour',width=size,height=size,alpha=False)
image.pixels.foreach_set(pixels.ravel());image.update();image.pack()
material=bpy.data.materials.new('Warm matte ceramic');material.use_nodes=True
shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.66
texture=material.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
material.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0],collection=scene.collection):
 bpy.ops.import_scene.gltf(filepath=str(OUT.parent/'floor.glb'))
 for obj in scene.objects:
  if obj.type!='MESH':continue
  obj.data.materials.clear();obj.data.materials.append(material)
  uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
  for loop in obj.data.loops:
   p=obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
   uv.data[loop.index].uv=(p.x/1.6,p.y/1.6)
 bpy.ops.export_scene.gltf(filepath=str(OUT/'tile-floor.glb'),export_format='GLB',use_active_scene=True,export_yup=True,export_animations=False,export_extras=True)
bpy.data.libraries.write(str(OUT/'tile-floor.blend'),{scene},fake_user=True,compress=True)
print('Tile finish exported on unchanged floor geometry')
