# Wall-mounted household plant

This asset reuses the native snake-plant meshes, adds a walnut shelf and brass wall support, and carries authored leaf, clay and soil materials. The source plant remains unchanged. Its GLB origin is the bottom centre of the shelf bracket; local +Z faces into the room and the mounting back is −Z. The [author](author.py) owns its native envelope.

Campaign room details own installation height. This is wall decoration, outside the floor object-placement and core collision contracts. It does not register a floor obstacle, food source or sensory cue. The shared room-detail owner handles loading, cutaway and disposal.

The author script imports the original native plant into a separate scene and exports the finished model without runtime material replacement. Geometry, materials and the supporting shelf belong to that source; only wall placement belongs to campaign content.
