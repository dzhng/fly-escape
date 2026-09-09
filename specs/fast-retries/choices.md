# Choices

## Sound

### Keep sufficient meadow coverage until the viewport changes — medium confidence

When a player returns to setup, its narrower sidebar asks for a smaller meadow even though the existing field already covers the view. The camera now retains the largest radius requested for that viewport and center. Actual viewport dimension changes reset it. This keeps one field rather than storing separate setup and playback scenes. The initial plan missed this remaining rebuild; matching the baseline measurement clock exposed it. An unusually wide inspection can leave a coarser meadow until resize because the existing cell limit still applies. Sound because it bounds memory to one field and removes repeated generation while retaining enough coverage for the view.

### Reduce terrain arithmetic before changing its lifetime — medium confidence

Returning to setup changes the camera's required meadow footprint. Rebuilding that meadow is expensive because each terrain point calculates a distance to every wall and room. The implementation compares squared distances and takes one square root after finding the nearest boundary. The plan did not anticipate this remaining cost. This removes avoidable work even when a new field is necessary. sound because it reduces the measured work without changing the generated geometry.

### Warm existing preview resources while editing — medium confidence

The first playback opens a roster with small fly pictures. Setup now starts the roster model download early, alongside the motion sampler. The downloaded bytes remain reusable; a mounted roster parses and owns its own model resources. A failed early load is retried by its actual consumer. The plan did not initially account for the roster's separate first-load request. This starts a small amount of presentation work even if the player never releases the flies. sound because setup already loads the larger world and this removes avoidable work from Start.

### Desktop acceptance uses action-to-frame limits — medium confidence

When a player clicks Retry, the useful end point is an editable house on screen. The plan requires that within 500 ms, and at least a 40% improvement over paired local measurements. Cold setup and Start have separate limits. The user asked for fast iteration without selecting a machine or latency target; these limits turn that request into a falsifiable local desktop contract. They do not promise the same speed on every device or connection. Future performance claims must identify the measured hardware and network conditions. sound because the limits directly cover the player's action and leave simulation semantics intact.

### Restore setup framing from its own anchor — high confidence

Retaining the world also retains the camera that playback moved to follow a fly. Re-entering setup must restore the original level anchor so the player sees the same editable house as before. Loaded artwork expands the camera's fitting bounds; recomputing the anchor from those expanded bounds displaced the house on retry. Preserve the original anchor while still fitting all artwork. The plan required unchanged framing but left the reset mechanism open. sound because future artwork can change size without silently moving the house's anchor.

### Keep the last truthful pose when production fails — high confidence

A failed attempt may still have a visible roster that resizes or redraws. Retain the latest recorded pose at that presentation owner so such a redraw does not call a disposed motion sampler. This cache contains one rendered pose per visible fly and does not fabricate later motion. The plan had not specified ownership after an interrupted run. Future redraws must retain the interrupted state until the player retries; the error label is intentional. sound because the visible state remains a recorded state even when production stops.

### Cancel a departed setup before accepting another level's work — high confidence

If the player changes levels while placement validation is pending, the shared client must let the new level submit its request. Cancel now rejects the old caller and forgets its request identifier, so a late reply cannot answer the new request. Previously each level had its own worker, which implicitly discarded that pending work when disposed. The ownership change made this behavior explicit. The pending native operation may finish, but its stale result has no consumer. Sound because the same reusable worker can recover without mixing two levels' state.

### Retain the whole level world, not a shared model cache — high confidence

After a run, the player sees the same house and wants to change a placement. Keeping that house's renderer, artwork and canvas until the level is left avoids rebuilding it. A global cache of parsed models would instead require several worlds to agree on which owner may free shared textures and geometry. The user did not specify resource ownership. This choice gives one level one owner, constrains memory to the mounted level and keeps future scene changes local. sound because repeated world construction is measured work and the retained world has an explicit final disposal point.

### Defer graph caching and preserve the playback lead policy — high confidence

Before this change, clicking Start incurred a small graph-construction cost and a larger world reconstruction cost. The existing playback clock waits until there is enough computed motion to play continuously. This pass removes repeated presentation work first; it does not add another graph cache or begin showing motion before the existing clock judges it sustainable. The user asked to fix the largest bottlenecks, not to introduce every plausible optimization. Future graph or clock changes need their own evidence. sound because the measured world reconstruction cost dominates the warm graph cost, and keeping the clock unchanged protects truthful playback.

### Each roster owns its parsed model — high confidence

When a roster closes, its graphics resources must be released. Keeping the parsed model globally allowed material and geometry listeners to keep every retired preview renderer alive. The game now retains only the downloaded bytes; each roster parses its own model and releases that model with its renderer. This costs a small parse on each opening but makes memory depend on the live roster, not the number of retries. The original plan had treated the existing preview cache as safe; the twenty-cycle heap evidence disproved that assumption. Sound because it removes the actual retaining ownership chain without broadcasting disposal to unrelated live renderers.
