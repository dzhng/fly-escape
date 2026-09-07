# Cancel setup without reviving its Worker

Switching levels while the first setup request is pending unmounts its component and disposes its client. Disposal rejects that request. The fallback for invalid stored placements previously treated cancellation as another validation failure and created a new Worker after its cleanup had already run. One orphan could remain for each such switch.

The setup owner now checks whether it is still mounted before retrying. Normal stored-placement recovery remains available while mounted; there is no timer, new resource owner or error suppression for the active level.

The focused browser gate holds the first level's Worker entry while the catalogue has loaded, then clicks the second level. The original code leaves two Workers and fails. Development and rebuilt static runs with the guard leave one Worker and a playable second setup. The browser script preserves both success and failure reports. Independent review requested the explicit enabled-release-button check, so loaded renderer assets alone cannot pass a broken setup.

Six actual twenty-fly release/pause/cancel cycles then exercised the rebuilt second house with the textured fruit. A single Worker and canvas remain after each cycle. DOM observations remain at one document, 160 nodes and 208 listeners; WASM allocation is 106,102,784 bytes in every sample. These are observed values, not new limits. Collected main-thread heaps vary between roughly 26.9 and 35.3 MB and end 2.86 MB above the first sample; this does not establish full memory stability. The existing offline heap gate finds one attached world canvas, no detached world canvases, and one current lighting-texture disposal listener. Raw snapshot is compressed; decompress before using tests/browser/renderer-heap.mjs.

The resource harness retains its original diagnostic route by default. RETRY_CAMPAIGN=1 or 2 opts into the actual static game's root route; level two uses stored one-star test progress only to unlock its UI. Both still run the real twenty-fly simulation. The initial campaign check failed on the orphan Worker; a later browser launch hit disk exhaustion before executing the focused test. Clean integrated scratch worktrees were removed, then the focused gate ran successfully. No launch failure is counted as game evidence.

This closes the measured unmount/retry defect and confirms the previous renderer retainer repair with the new materials. It is not ten full attempts, whole-process/GPU memory proof, campaign calibration or final release acceptance.
