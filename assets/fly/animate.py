"""Run after author.py, through Blender Python with __file__ set.
Append only the saved static fly scene; do not rerun on an already rigged source.
Rigid bone weights preserve the authored silhouette and keep future mesh batching possible.
All curves are deterministic; FlyRoot never receives animation or movement.
"""
import bpy
import math
import re
from pathlib import Path
from mathutils import Vector, Quaternion

OUT = Path(__file__).resolve().parent
with bpy.data.libraries.load(str(OUT/'fly.blend'), link=False) as (source, target):
    target.scenes = source.scenes
scene = target.scenes[0]
scene.name = 'FlyMotion'
bpy.context.window.scene = scene
# Blender suffixes appended datablocks when another fly scene is already open.
def named(prefix):
    return next(o for o in scene.objects if o.name == prefix or re.fullmatch(re.escape(prefix) + r'\.\d+', o.name))
root = named('FlyRoot')
meshes = [o for o in scene.objects if o.type == 'MESH']
rig = bpy.data.objects.new('FlyRig', bpy.data.armatures.new('FlySkeleton'))
scene.collection.objects.link(rig)
rig.parent = root
floor = -0.002360410988330841
with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0],
                               object=rig, active_object=rig,
                               selected_objects=[rig], selected_editable_objects=[rig]):
    for obj in scene.objects: obj.select_set(False)
    rig.select_set(True)
    scene.view_layers[0].objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name, head, tail, parent=None):
        b=rig.data.edit_bones.new(name)
        b.head=Vector(head)+Vector((0,0,floor))
        b.tail=Vector(tail)+Vector((0,0,floor))
        if parent: b.parent=rig.data.edit_bones[parent]
    bone('Body',(0,0,0.35),(0,0,0.5))
    bone('Head',(0,-0.14,0.40),(0,-0.30,0.40),'Body')
    bone('Proboscis',(0,-0.35,0.34),(0,-0.395,0.29),'Head')
    for sign,side in [(-1,'L'),(1,'R')]:
        bone('Wing.'+side,(sign*0.11,-0.055,0.535),(sign*0.32,0.23,0.565),'Body')
        for index,(ay,ky,ty) in enumerate([(-0.13,-0.22,-0.36),(0,-0.015,0.055),(0.14,0.25,0.43)],1):
            a=(sign*.12,ay,.35); k=(sign*(.235+.025*index),ky,.22)
            ankle=(sign*(.295+.025*index),ty,.027); toe=(sign*(.355+.025*index),ty-.055,.009)
            base=f'Leg{index}'
            bone(base+'Upper.'+side,a,k,'Body')
            bone(base+'Lower.'+side,k,ankle,base+'Upper.'+side)
            bone(base+'Foot.'+side,ankle,toe,base+'Lower.'+side)
    bpy.ops.object.mode_set(mode='OBJECT')
for obj in meshes:
    name=obj.name
    canonical=re.sub(r'\.\d+$', '', name)
    if canonical.startswith('Leg'): target=canonical
    elif canonical.startswith('Wing'): target='Wing.'+canonical.split('.')[1]
    elif canonical=='Proboscis': target='Proboscis'
    elif canonical.startswith(('Head','Eye','Antenna')): target='Head'
    else: target='Body'
    group=obj.vertex_groups.new(name=target)
    group.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
    obj.parent=rig
    modifier=obj.modifiers.new('FlySkeleton','ARMATURE'); modifier.object=rig
scene.render.fps=30
clips={'Walk':30,'Fly':15,'Land':24,'Feed':30}
rig.animation_data_create()
for clip,last_frame in clips.items():
    action=bpy.data.actions.new(clip)
    rig.animation_data.action=action
    for frame in range(last_frame+1):
        t=frame/last_frame
        rotations={name: Quaternion() for name in rig.pose.bones.keys()}
        def rotate(name,axis,angle):
            local=rig.data.bones[name].matrix_local.to_3x3().inverted()@Vector(axis)
            rotations[name]=Quaternion(local,angle)@rotations[name]
        envelope=1 if clip=='Fly' else max(0, 1-t/0.72)**0.6
        reach=(1-math.cos(t*math.tau))/2 if clip=='Feed' else 0
        for sign,side in [(-1,'L'),(1,'R')]:
            if clip in ('Fly','Land'):
                rotate('Wing.'+side,(0,1,0),-sign*.5*(1-math.cos(t*math.tau*2))*envelope)
            for index in range(1,4):
                upper=f'Leg{index}Upper.{side}'
                if clip=='Walk':
                    phase=t*math.tau+(math.pi if (index+(side=='R'))%2 else 0)
                    rotate(upper,(0,0,1),.42*math.sin(phase))
                    rotate(upper,(0,1,0),-sign*.52*max(0,math.sin(phase)))
                elif clip in ('Fly','Land'):
                    rotate(upper,(0,1,0),-sign*.65*envelope)
        if clip=='Feed':
            # Extend toward the contact surface as the head bows, then retract.
            rotate('Head',(1,0,0),.40*reach)
            rotate('Proboscis',(1,0,0),-.20*reach)
        for name,quaternion in rotations.items():
            pose=rig.pose.bones[name]; pose.rotation_mode='QUATERNION'; pose.rotation_quaternion=quaternion
            pose.keyframe_insert('rotation_quaternion',frame=frame,group=name)
            pose.scale=(1, 1+3.2*reach if name=='Proboscis' else 1, 1)
            pose.keyframe_insert('scale',frame=frame,group=name)
    # NLA track names give stable glTF clip names without baking a combined timeline.
    track=rig.animation_data.nla_tracks.new(); track.name=clip
    track.strips.new(clip,0,action)
    track.mute=False
rig.animation_data.action=None
for pose in rig.pose.bones: pose.rotation_quaternion=Quaternion()
scene.frame_set(0)
with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0],
                               object=rig, active_object=rig,
                               selected_objects=[rig], selected_editable_objects=[rig]):
    for obj in scene.objects: obj.select_set(obj in meshes or obj in (root,rig))
    bpy.ops.export_scene.gltf(filepath=str(OUT/'fly.glb'),export_format='GLB',
        use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
for track in rig.animation_data.nla_tracks: track.mute=True
rig.animation_data.action=None
for pose in rig.pose.bones: pose.rotation_quaternion=Quaternion()
scene.frame_set(0)
bpy.data.libraries.write(str(OUT/'fly.blend'),{scene},fake_user=True,compress=True)
print('Saved clips',clips,'meshes',len(meshes))
