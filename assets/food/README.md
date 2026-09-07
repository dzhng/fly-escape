# Food and scent assets

The [apple](apple/README.md) uses native metre-scale geometry shared with the core's edible surface queries. Contact geometry and odor emission are separate: being near an odor source does not establish food contact.

The [banana shape study](banana/README.md) is an unregistered neutral asset. Its exported topology is validated independently of food behavior; runtime contact and photorealistic art remain separate acceptance gates.

Scent crumbs are odor-only floor cues. Their Blender source in [author.py](author.py) has a radius-one footprint and shallow relief; the placement renderer scales X/Z using the core catalog. This contract keeps a scent marker from implying an unmodeled solid obstacle.

The main workbench inspects and replaces floor cues. The contact workbench inspects edible geometry against core-computed support poses. Replacement must preserve the applicable physical contract; a changed edible mesh must be baked for the core before its visual replacement is accepted. Templates own resources, instances share geometry/materials, and failed replacement preserves the accepted model.
