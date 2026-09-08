# Asset workbench

Run `bun run dev:assets` from the repository root. The workbench uses the production loader, renderer and pose samplers, so a replacement is inspected through the same browser path as gameplay. Replacement affects only the open workbench, never the source asset. Failed or superseded loads preserve the visible model; the view owns installed resources.

The [asset contract](../../specs/done/help-the-fly-escape/CONTRACTS.md#selection-camera-and-assets) defines orientation and scale. Models must satisfy their native envelope rather than being silently rescaled. Instances share geometry and materials while retaining independent animation state. Keep descriptive glTF metadata out of loader-reserved fields: Three.js interprets `extras.pivot` as a numeric vector. A Blender round-trip cannot catch every browser-consumer error.

The [application](src/) owns diagnostic fixtures and replacement controls. These inspect geometry, materials and recorded poses; they do not make neural decisions or establish game balance. Contact fixtures consume core-generated support poses instead of calculating a second surface attachment in the browser. Animation inspection uses explicit clip time, so pause and seeking do not change simulation state.

Source and physical contracts live with the [fly](../../assets/fly/README.md), [house](../../assets/house/README.md), [food](../../assets/food/README.md), [household props](../../assets/household/README.md) and [scale fixture](../../assets/proportions/README.md). Diagnostic shape studies do not become campaign content merely because the workbench can load them.

Object pictures are offline renders of the same models. With the workbench running, use `node apps/asset-lab/scripts/render-object-thumbnails.mjs`; set `ASSET_LAB_URL` for a different local address. The [object registry](../../assets/tools/README.md) owns model and thumbnail identity. Regenerate pictures when replacing a model so the palette and world agree without allocating a renderer per button.
