# Closed household window

This original Blender shape uses two closed panes, inset sash frames and a single
handle to distinguish its front. Rebates back the sash clearance; a dark reveal
must not imply an accidental through-gap. The authored GLB carries ivory paint, muted opaque glass and brass hardware.
Physical glass optics remain open; the renderer preserves these materials.

The [authoring source](author.py) inherits the proposed window dimensions from
the [room-scale fixture](../../proportions/scale.json). Its local origin is the
bottom centre of the sill, with GLB +Y up and +Z toward the room. Installation
height belongs to room placement. The shared house exporter validates native
bounds without stretching and keeps the neutral stage outside the GLB.

Campaign scene details mount this closed model on existing walls. It neither
cuts a physical opening nor creates an escape route. Optical glass and daylight
remain separate from this authored material finish.
[Authoring evidence](../../../specs/help-the-fly-escape/assets/evidence/21/window-prepared/README.md)
records the neutral review and remaining integration gates. No downloaded assets
or textures are used.
