# Neutral physical-scale fixture

This is a diagnostic composition, not production house art or a campaign level. `scale.json` owns the proposed metre units, room/solid dimensions and visual proxy dimensions. Cabinet, seat and pot are geometry-owned cuboid envelopes. The apple, banana, window and doorway lintel establish scale; they add no accepted food/support/collision semantics.

`author.py` runs through Blender MCP and writes only a newly named scene, its scoped `.blend`, and the diagnostic GLB. It preserves other scenes. The GLB normalizes the one room's floor X/Z coordinates for the existing floor-instance transform. Its above-floor content deliberately violates the production floor-kit bounds: only the explicitly labeled proportions workbench composes it. Production kit and placement loaders remain strict. Replace this diagnostic composition with geometry-owned furnishing/food identities in their later owning slices; do not promote it as a modular kit.

The native fly export measures3mm. The proportions workbench uses the calibrated core dimensions and recorded poses. Wide-view display enlargement is presentation-only; native close views retain the physical scale. See the [physical adoption evidence](../../specs/help-the-fly-escape/assets/evidence/25/adoption/README.md).

The contact workbench (`?fixture=contact`) isolates native model attachment to a curved mesh. Its fixed points and orientations are exported by `crates/sim/examples/contact_pose_fixture.rs` using the same core queries as contact integration. Regenerate `contact-fixture.json` from that example; the browser consumes this output rather than calculating a second surface pose. This is a geometry diagnostic, not a neural attempt or an additional campaign level.
