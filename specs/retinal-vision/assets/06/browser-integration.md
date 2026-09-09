# Browser tick integration

The production attempt worker now prepares each native tick, captures its frozen active poses in one worker-owned physical world, and commits the matching RGB8 batch before advancing the existing neural/body loop. It reserves a chunk credit before acquisition. Cancellation disposes capture and world resources, cancels the native pending tick and rejects late results by run identity. A new run resumes only after the old pump yields.

The map is published as a separate reviewed artifact under `data/processed/brain/retinal-map.json`; the graph and its manifest stay unchanged. The browser checks its optical semantics against the same owner used by the exporter, then native checks exact map/profile/rig/layout/color identities and bounds. The original map text crosses the boundary without JSON reserialization. Reordered samples at the same dimensions and changed exposure are rejected. Browser HTTP revalidation owns map caching; rejected or stalled downloads cannot poison a later attempt.

The native resolved setup exposes `fixedPlacements` alongside user placements. Both sensory and playback worlds consume those canonical placements, including map-owned fan headings. Optional physical authoring travels in the start command; campaign playback supplies room details, floors and shared lighting whenever its tuning enables vision. Nonvisual lab attempts retain their existing path until final cutover removes baseline visual callers.

## Verified seams

[Physical worker execution](physical-worker.json) captures twelve ticks for two flies, packs two chunks and preserves 103,824 RGB bytes. Reconsuming those archived inputs in a fresh WASM instance reproduces every packed neural/body/motion/eye value, with exact prepared identities and poses. Native RGB-current fixtures and transaction tests remain green. The one-fly diagnostic UI and full browser/native experiment presentation remain open integration work.

[Scene cancellation](scene-cancel.json) and [map cancellation](map-cancel.json) recover from deliberately hung downloads. Restarting during GPU acquisition publishes no stale chunk. [Context loss and stalled fences](worker-faults.json) reject without publishing a failed frame, settle within five seconds on the documented Chrome hardware and allow a new attempt. A main-thread watchdog separately covers a worker that cannot run its own fence timer; queued idle notifications cannot cancel that deadline while newly granted work remains outstanding. Hidden-page time is excluded by the client.

[Rejected-map recovery](map-retry.json) replaces malformed JSON, an incompatible profile and a native-invalid map with valid responses on the same client. None is retained as a permanent failure. Existing nonvisual client tests, native transaction/record tests, type checking and renderer tests pass.

Independent review found and drove fixes for cleanup exceptions, cancellation during asset loading, queued-idle/credit races, and poisoned map retries. The final browser probes test these observed failure paths. No retry substitutes old or black input for a failed capture.

**Status:** production seam integrated and browser transaction/failure probes verified. Full campaign resource acceptance, the one-fly diagnostic checkpoint and spatial/chromatic evidence are tracked separately; this does not declare the feature complete.
