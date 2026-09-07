# Household props

These props make occupied rooms legible through familiar domestic objects. Warm,
muted materials and mesh silhouettes carry their identity without external
textures or shader-specific effects. Their appearance does not imply simulation
behavior; integration owns attraction, feeding, collision, and hazards.

[The authoring source](author.py) builds isolated native-metre Blender scenes.
Each export is grounded at zero and re-imported to check its measured envelope.
The adjacent envelope files describe glTF Y-up bounds; use those actual bounds
when mounting an object, rather than stretching the model to a nominal box.
The web is a vertical surface intended to be mounted beside a wall or in a corner.

Blender staging is authoring evidence, not production acceptance. The cloth is
loose linen rather than a recognizably cut garment; the cat is a simplified
sculpture. Both need judgment at the gameplay camera scale. Web threads and
appliance grille detail particularly need checking against real room lighting.
