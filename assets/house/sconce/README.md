# Household wall sconce

This neutral shape proposal is a compact shaded household wall light, distinct from the gameplay floor-source lamp. Proposed native size is 22 cm wide, 32 cm high and 16 cm deep. Its local origin is centred beneath the envelope; GLB +Y is up, +Z faces into the room and the mounting back is the −Z plane. The origin is an asset placement convention, not a claim that sconces mount at floor level.

The shade, curved supporting arm, socket and backplate form a connected assembly. Each authored part is a closed mesh; separate parts overlap at their physical attachments. A shade cavity is visible geometry, not new collision space. Neutral material has no emission. The source reuses the shared house export and stage helpers; authored geometry and stage context remain in separate native scenes.

No catalogue, wall-placement rule, gameplay light cue, scene light or physics is added by this asset. Browser framing and mounting integration must be verified before adoption; material and lighting treatment are separate gates.

[Blender source](author.py) owns the original geometry and proposed dimensions; no third-party mesh or texture was used. Run it through Blender to recreate the native file, GLB and neutral views. The [shape evidence](../../../specs/help-the-fly-escape/assets/evidence/21/sconce-prepared/README.md) records export checks, critique and remaining adoption gates.
