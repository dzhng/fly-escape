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

Native contact preserves the complete baked mesh. Disconnected authored pieces
become stable, edge-connected support surfaces so each closed piece keeps the
contact engine's manifold-boundary guarantees. A placement's edible role is
separate from its geometry: shoes, dishes, linens, and the cat support bodies
without granting taste or energy. Odor strengths are explicit game assumptions
owned by the placement catalog.

The web uses an open fan of strands between the wall and floor, with separate
anchor endpoints that preserve closed manifold components. Native web contact acts
only on those strands and the visible spider; gaps remain passable. Catching on
contact is a game rule, not a model of adhesive mechanics. Mounting uses the
actual rendered wall face while respecting placement clearance. Dotted silk at
room scale, stiff legs, and upper attachment against a transparent cutaway wall
remain appearance limitations; the fan does not establish full art acceptance.
