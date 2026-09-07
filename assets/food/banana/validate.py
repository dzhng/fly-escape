"""Validate exported banana topology and native-source integrity in Blender."""
from pathlib import Path
import bpy, bmesh, json
from mathutils.bvhtree import BVHTree

OUT = Path(__file__).resolve().parent
scene = bpy.data.scenes.new('Banana-TopologyValidation')
try:
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0], collection=scene.collection):
        bpy.ops.import_scene.gltf(filepath=str(OUT/'banana.glb'))
    objects = [o for o in scene.objects if o.type == 'MESH']
    assert len(objects) == 1
    bm = bmesh.new()
    try:
        bm.from_mesh(objects[0].data)
        # Only the temporary inspection mesh is welded (10 nm), to join GLB
        # attribute-split vertices. Authored/exported geometry is never modified.
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-8)
        bm.faces.ensure_lookup_table()
        tree = BVHTree.FromBMesh(bm, epsilon=0)
        overlaps = [(a,b) for a,b in tree.overlap(tree) if a<b
                    and not set(bm.faces[a].verts).intersection(bm.faces[b].verts)]
        report = {
            'importedVerticesAfterWeld': len(bm.verts), 'triangles': len(bm.faces),
            'boundaryOrNonmanifoldEdges': sum(not e.is_manifold for e in bm.edges),
            'inconsistentEdges': sum(not e.is_contiguous for e in bm.edges),
            'degenerateFaces': sum(f.calc_area()<=1e-12 for f in bm.faces),
            'signedVolumeM3': bm.calc_volume(signed=True),
            'nonAdjacentTriangleBvhOverlaps': len(overlaps),
            'eulerCharacteristic': len(bm.verts)-len(bm.edges)+len(bm.faces),
        }
        assert report['boundaryOrNonmanifoldEdges'] == report['inconsistentEdges'] == report['degenerateFaces'] == 0
        assert not overlaps and report['signedVolumeM3']>0 and report['eulerCharacteristic']==2
    finally:
        bm.free()
    with bpy.data.libraries.load(str(OUT/'banana.blend')) as (source, target):
        report['savedNativeScenes'] = list(source.scenes)
        target.scenes = [name for name in source.scenes if 'Metres' in name]
    native = target.scenes[0]
    native_objects = list(native.objects)
    report['nativeMeshVertices'] = sum(len(o.data.vertices) for o in native_objects if o.type == 'MESH')
    assert report['nativeMeshVertices'] == report['importedVerticesAfterWeld']
    for obj in native_objects:
        mesh = obj.data
        materials = list(mesh.materials)
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh.users == 0: bpy.data.meshes.remove(mesh)
        for material in materials:
            if material.users == 0: bpy.data.materials.remove(material)
    bpy.data.scenes.remove(native)
    evidence = OUT.parents[2]/'specs/help-the-fly-escape/assets/evidence/21/banana-prepared'
    (evidence/'topology.json').write_text(json.dumps(report,indent=2)+'\n')
    print(report)
finally:
    for obj in list(scene.objects):
        mesh = obj.data if obj.type == 'MESH' else None
        materials = list(mesh.materials) if mesh else []
        bpy.data.objects.remove(obj,do_unlink=True)
        if mesh and mesh.users == 0: bpy.data.meshes.remove(mesh)
        for material in materials:
            if material.users == 0: bpy.data.materials.remove(material)
    bpy.data.scenes.remove(scene)
