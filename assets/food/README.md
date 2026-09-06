# Floor food assets

Fruit is a citrus cut face; crumbs are separate crust-edged morsels. Both are Blender-authored static meshes with native horizontal radius at most one, +Y up in GLB, pivot at floor contact, and maximum relief 0.005 world units. The renderer scales only X/Z by the authoritative catalog footprint. Relief is deliberately near-flush: these non-solid cues must not look like furniture blocking planar flies.

Fruit retains odor and edible body-contact semantics. Scent crumbs retain odor only. The core fruit food radius exceeds its placement footprint, and body-radius overlap can initiate feeding outside the drawn fruit. Neither the art nor renderer changes that recorded movement/heading. Grounded attached feeding is the visual target; physically exact mouth intersection is not claimed.

Each `.blend` contains a separate source scene; `author.py` can recreate the assets through Blender MCP or Blender's Python runner. `roundtrip.json` records GLB re-import bounds/counts. Rind, pith, flesh and crumbs retain their own material roles; room palette and lights are independent. Seeds sit above the flesh rather than coplanar with it.

The shared placement-model loader validates finite vertices, radius, relief, static topology and a 5000-triangle ceiling. The existing asset workbench exposes catalog-scale placement and local GLB replacement. Templates own resources; placements share those resources and own transforms. Failed replacement preserves the previously accepted model.
