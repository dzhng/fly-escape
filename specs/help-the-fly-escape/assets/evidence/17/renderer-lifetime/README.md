# Renderer-owned lighting texture

Status: the identified Three canvas-retention defect is repaired and verified; this is not full release-memory acceptance.

## Measured cause

The clean pre-inspector heap rooted Three 0.185.1's module-global `DFG_LUT` through its disposal-listener array, per-renderer WebGLTextures closures, native WebGL contexts and detached world canvases. The [initial exact IDs](initial-retainers.txt) show ten detached canvases and one live canvas. A second BFS excluded weak edges, WeakMap ephemeron shortcuts, InjectedScript, Inspector nodes and DevTools console edges; the texture remained rooted through native Window → document → React component → module scope. `DOM.getDetachedDomNodes` was never called for the new before/after snapshots.

The [patch](../../../../../../patches/README.md) makes each renderer own a Texture clone, sharing only immutable Source data, then disposes that clone before clearing its renderer properties. The application continues to use its existing disposal contract.

## Red/green evidence

| Built candidate | Real Run/cancel cycles | DOM nodes | Final LUT listeners | Detached world canvases |
| --- | ---: | --- | ---: | ---: |
| Original | 6 | 103 → 113, +2/cycle | 13 | 12 |
| Patched | 6 | 101 throughout | 1 | 0 |
| Patched | 20 | 101 throughout | 1 | 0 |

Each final heap retains one active world canvas. Reports and offline heap summaries are in the named before/after folders. The original six-cycle DOM and source-specific heap assertions fail; both patched runs pass. The root's separately banked original twenty-cycle report showed 103 → 141 nodes and +4.31 MB main heap.

Patched twenty-cycle main heap still rises 13,667,724 → 15,579,408 bytes; the last ten samples rise 506,308 bytes. Worker WASM remains 92,340,224 bytes with exactly one Worker, no page errors and unique actual attempt/seed identities. **Remaining heap growth is not explained or accepted away by this repair.** Clean raw snapshots are retained locally under `/tmp/fly-lut-{before-six,after-six,after-twenty}/clean.heapsnapshot`; compact results are committed instead of large runtime heaps.

Two simultaneous WorldViews retain identical survivor pixels and workload after the other is disposed: 69 draws, 5,900 triangles, 11 geometries and 3 textures. Production setup canvas pixels also match exactly across unpatched/patched builds. All five final comparison images received a separate visual review: no blank/corrupt state or visible content difference. Reviewer disclosed prior setup/palette/house context, inspected no patch source, and limited the verdict to captured pixels.

## Reproduction and review boundary

Build the web app with its prepared real WASM/graph and serve its production output. `tests/browser/retry-resources.mjs` accepts `BRAIN_URL`, `RETRY_RUNS`, `RETRY_EVIDENCE`, and `RETRY_ASSERT_STABLE=1`; its snapshot precedes any inspector DOM query. Run `HEAP_ASSERT_STABLE=1 node tests/browser/renderer-heap.mjs <clean.heapsnapshot>` to pin the actual retained objects, rather than relying on noisy heap byte totals.

The separate two-view fixture builds with `node apps/web/node_modules/vite/bin/vite.js build --config tests/browser/renderer-lifecycle.vite.ts`; serve that output and use `LIFETIME_URL` with `renderer-lifecycle.mjs`. It loads the real shared WorldView/Geometry and compares survivor resources/pixels through disposal.

A fresh directory and empty Bun cache installed the frozen lockfile successfully; all three patched implementation files were byte-identical to the tested installation. Typecheck, production build and 30 renderer tests/180 assertions pass. Independent parent source review approved the ownership/disposal order. The requested Codex CLI review was attempted but rejected because its installed version cannot run the configured model; it supplied no review verdict. No dependency version changed.

Decision audit: dependency-local ownership avoids a hidden-texture application wrapper or global broadcast. Source, ES module and CJS are patched together because package exports, not source-file presence, determine the running implementation. Exact pixel equality is used here because this lifecycle-only repair intentionally changes no visual variable. Full-attempt/browser release gates remain separate.

Merged root verification: frozen Bun install, typecheck, 30 renderer tests and both production app builds pass. The two-view production fixture also preserves identical survivor pixels and resources after disposal (69 draws, 5,900 triangles, 11 geometries, 3 textures), with no browser errors. Remaining heap-growth investigation is unchanged.

## Residual heap classification

A separate read-only comparison of the clean patched six- and twenty-cycle snapshots found live-node self sizes rising 19,586,324 → 20,543,967 bytes (+957,643). This metric differs from CDP used-heap bytes. Ordinary objects grew only 24 bytes; closure count stayed 11,349 and normalized context counts stayed constant. Both retained one attached world canvas and one LUT listener, with no detached world canvases.

Most additional code bytes (+541,872) are compiled instruction streams and deoptimization metadata. Native growth includes 280 NetworkResourcesData records retained by the DevTools Network inspector, plus browser performance-resource and layout-shift timeline buffers; those timeline objects are normal browser owners, not proof of retired application views.

The current renderer's 45 WebGLBindingStates program-map backing stores grew from 49,000 to 151,060 bytes while map count stayed fixed. Concrete retainers run through the current canvas/context and binding-state closure. Three uses globally increasing numeric WebGLProgram IDs as object keys; the observed backing-store capacities are consistent with sparse numeric element allocation in the current maps, not retained old renderer maps. This is an inference from two snapshots, not proof of eventual bounds. Final release measurements still need to establish warm-run behavior before making a full memory claim. Do not add another dependency patch on this evidence alone.
