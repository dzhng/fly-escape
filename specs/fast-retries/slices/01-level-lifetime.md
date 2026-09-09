# Keep the level world alive

## Contract

Releasing, canceling and retrying a level keep its rendered house and loaded assets alive. The player returns to the same editable arrangement promptly, with no fly, trail, outcome, selection or callback from the previous attempt leaking into setup.

## Seam and decisions

SetupGame owns its level WorldView through unmount. Its setup phase and AttemptPlayback borrow that world in sequence; a standalone PlaybackLab owns a world itself. Add an explicit attach-to-host operation to WorldView if the canvas host changes: update the host, resize observation and viewport together. Never maintain a second hidden world or copy scene resources. Keep phase-specific React state and handlers in their existing components; each phase cleans up its RAF and handlers without disposing a borrowed world. Resource disposal belongs only to the owner.

The campaign owns the AttemptClient used for catalog, setup and attempts. Changing levels cancels the attempt and resets receivers while keeping at most one worker. The diagnostic setup entry follows the same ownership rule. Retain existing failure retirement and recreation behavior.

Reset setup presentation through an explicit renderer contract: hide all flies and outcome indicators, clear trails/selection/follow state, restore the spawn region and normal camera input, and show authoritative placements. On release apply the new attempt's initial bodies before playback. Preserve the existing phase framing, visual scale and fly previews. Begin loading the pure motion sampler and the roster-preview bytes during setup; initialization must be reusable and failed preparation must be retried by the consuming playback/preview loader. Each mounted roster owns its parsed model, as specified in the preview-lifetime slice. Canceling a departed setup rejects its pending request and ignores its late reply, allowing the next level to resolve using the same client.

Implementation may choose private names, React effect boundaries and the smallest typed handoff. It may not add global asset caches, another session manager, a parallel render loop or separate scene clones. The shared world must have one final disposal path and tests must exercise actual consumers.

## Verification

First add a browser check at the production campaign surface that captures canvas identity across Release/Cancel/Retry and observes world-asset requests. Run it against the baseline and confirm it fails because the world is reconstructed. Then implement and require identical canvas identity, no repeated asset loading and a correctly reset editable scene.

Extend the existing retry-resource harness with action-to-frame timings and fix its stale twenty-fly description. Run the paired seeds, both levels, repeated cycles, level switches, setup hover/commit/cancellation, playback failure and selection/replay checks. Inspect the retained heap/DOM and renderer resource counts after warm-up. Meet the README timing and resource targets before accepting the pass.

Capture setup, a paused selected fly, return-to-setup, and a second attempt. Use compare-screenshots to judge unintended presentation changes against the baseline, then run an unprimed screenshot-critique as the final visual check. Show the user the shots through preview-shots; feedback is a non-blocking checkpoint while other tests continue. A visual regression or stale state reopens the pass.

The playable deliverable is the ordinary campaign route. Faster returns must remain visible through real interactions; a unit test of a new helper cannot prove this contract.
