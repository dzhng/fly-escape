# Kitchen floor comparison

Bounded kitchen finish accepted; slice 22 remains open. The two kitchens read distinctly from wood rooms at whole-house scale, while close stone detail remains soft/cloudy and unusually uniform. Grout reads as a drawn grid rather than recessed joints. The plain butt seam at doorways is visually acceptable for this pass.

`before/after-{1,2}-{whole,kitchen,threshold}.png` are actual game setup captures at identical viewport, pointer pan and wheel input. Before substitutes the existing wood GLB only for the tile asset fetch; after uses the authored tile GLB. Geometry, lighting, camera code and all other assets are identical. Pixel differences in `pixel-comparison.json` measure visible change, not realism. Animated exterior scenery can contribute to those differences.

Independent visual review inspected all twelve full images and enlarged doorway crops. It accepted credible tile scale relative to cabinets, narrow grout, and flush joins with no visible gap, overlap, clipping, raised lip or floor outside room bounds. The authoring source is linked from the [asset notes](../../../../../../assets/house/tile-floor/README.md).

## Gates and limits

The renderer suite passes 52 tests. Focused tests compare the full canonical floor export (20 vertices, 36 triangles, exact values/order), check authored metre UV density across different room dimensions, and observe resource disposal: replacing tile releases its previous texture once, leaves wood live and unchanged, and final scene disposal releases retained wood/tile textures once. The existing asset-loading suite covers stale imported models. TypeScript passes using worktree package aliases because this isolated checkout shares dependencies with root.

`playback.json` records two release/pause/cancel cycles per house: each reached native model ready, playing and tick 10 or later with 20 flies; no page errors. `playback-1/2.png` show the original close fly framing on wood; they do not prove tile visibility. The merged pass below corrects this framing. Seeds and sampled poses differ, and early renderer counts include asynchronous environment work; these four samples are **not a resource plateau measurement**. Ownership acceptance rests on the deterministic disposal test, not stable whole-scene counts.

The portable asset adds one 1024² image and one material, 325,504 GLB bytes. Estimated RGBA8 plus mip storage is 5.33 MiB per loaded finish; room instances share the texture. No additional room floor mesh, light, simulation geometry, surface budget or physical rule is introduced. `validation.json` records the exact GLB identity.

Manual code review and parent review found no remaining ownership/threading issue. The independent CLI review was attempted but could not run: the installed CLI rejected the configured model as requiring a newer version. No model substitution or installation was performed.

## Reproduce

Run from repository root with dependencies, brain artifacts and current WASM available. Serve the current web app with Vite on port 31856 (the recorded worktree used explicit aliases to its renderer/client source). Then:

```sh
node specs/help-the-fly-escape/assets/evidence/22/kitchen-tile/tile-shots.mjs
node specs/help-the-fly-escape/assets/evidence/22/kitchen-tile/tile-playback.mjs
bun run test:renderer
bun run typecheck
```

Set `URL` to use another server. Both browser scripts write to `/tmp/kitchen-tile-shots` and close Chrome in `finally`; run sequentially. Captures are human-reviewed evidence, not an automated image acceptance test. Browser output includes build identity in `playback.json`.

## Choices

Appearance belongs to campaign content keyed by actual room ID, with wood as the default. This avoids copying room rectangles or teaching simulation about finishes. Each room keeps one existing floor instance. The loader replaces resources only for the assigned finish, avoiding parallel overlays or a hidden floor cache. Flat baked grout keeps physical geometry exact and texture cost bounded; recessed-joint realism is explicitly deferred.

## Root integration

The merged production web and asset-lab builds pass alongside all 52 renderer tests, 2 asset identity tests and TypeScript. Static serving at port 5322 passes both houses' setup captures and two 20-fly release/pause/cancel cycles per house with no page errors. `merged/playback.json` records the rebuilt simulation identity. The screenshot harness now waits for the enabled release button (including world assets), and its wood substitution also matches production asset filenames.

`integration.json` records canvas changes from wood and differences from the earlier reviewed captures. Animated exterior scenery and input timing affect these counts; this is not an exact pixel-equivalence claim. Final floor review uses the merged images themselves. Final campaign balance, long-run memory and photorealism remain open.

The comparison was shown in Preview from 20:49 to 20:54 UTC for non-blocking review. No response arrived; retain the independently reviewed tile treatment and close Preview. Close texture/grout realism remains open.

The first merged playback screenshots also followed a fly over wood; independent review rejected them as evidence of kitchen appearance. The harness now uses wheel zoom and a short drag to frame the house. Corrected `merged/playback-1.png` and `merged/playback-2.png` show the tiled kitchens in replay; earlier close frames remain with the original evidence.

Independent review accepts all six merged setup frames and the corrected two replay frames: tile stays confined to kitchens, with clean wood transitions and no visible gap, overlap or false height. The first replay house is cropped at the bottom, but its kitchen and joins remain visible.
