# Food and scent assets

The [apple](apple/README.md) uses native metre-scale geometry shared with the core's edible surface queries. Contact geometry and odor emission are separate: being near an odor source does not establish food contact.

The [banana](banana/README.md) shares the apple’s native edible-surface and placement ownership. Food shapes are separate from scent crumbs; registering a fruit does not establish a food-dependent campaign solution.

Scent crumbs are odor-only floor cues. Their Blender source in [author.py](author.py) has a radius-one footprint and shallow relief; the placement renderer scales X/Z using the core catalog. This contract keeps a scent marker from implying an unmodeled solid obstacle.

The main workbench inspects and replaces floor cues. The contact workbench inspects edible geometry against core-computed support poses. Replacement must preserve the applicable physical contract; a changed edible mesh must be baked for the core before its visual replacement is accepted. Templates own resources, instances share geometry/materials, and failed replacement preserves the accepted model.

The [contact exporter](../../apps/asset-lab/scripts/export-contact.ts) preserves
rendered triangle coordinates and winding, while giving exactly coincident
world-space positions one geometric identity. Shading or material splits must
not open the physical skin. This uses no tolerance and does not remove overlapping
faces; invalid contact topology remains an authoring error. Canonical contact
data is reproduced from the GLB by the asset tests.
[Seam regression evidence](../../specs/help-the-fly-escape/assets/evidence/20/mesh-seams/README.md)
records why the geometric identity rule matters to closed-food containment.
