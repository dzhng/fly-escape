# Choices

## Sound

### Desktop acceptance uses action-to-frame limits — medium confidence

When a player clicks Retry, the useful end point is an editable house on screen. The plan requires that within 500 ms, and at least a 40% improvement over paired local measurements. Cold setup and Start have separate limits. The user asked for fast iteration without selecting a machine or latency target; these limits turn that request into a falsifiable local desktop contract. They do not promise the same speed on every device or connection. Future performance claims must identify the measured hardware and network conditions. Chosen during planning; sound because the limits directly cover the player's action and leave simulation semantics intact.

### Retain the whole level world, not a shared model cache — high confidence

After a run, the player sees the same house and wants to change a placement. Keeping that house's renderer, artwork and canvas until the level is left avoids rebuilding it. A global cache of parsed models would instead require several worlds to agree on which owner may free shared textures and geometry. The user did not specify resource ownership. This choice gives one level one owner, constrains memory to the mounted level and keeps future scene changes local. Chosen during planning; sound because repeated world construction is measured work and the retained world has an explicit final disposal point.

### Defer graph caching and preserve the playback lead policy — high confidence

Clicking Start currently incurs a small graph-construction cost and a larger world reconstruction cost. The existing playback clock waits until there is enough computed motion to play continuously. This pass removes repeated presentation work first; it does not add another graph cache or begin showing motion before the existing clock judges it sustainable. The user asked to fix the largest bottlenecks, not to introduce every plausible optimization. Future graph or clock changes need their own evidence. Chosen during planning; sound because current measurements meet the start targets on paired seeds and identify returning to setup as the remaining latency failure.
