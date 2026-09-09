# Near-doorway input-only proposal

The original ground-level occlusion pair changed too little input to establish
the required downstream voltage response. This proposal changes only the optical
stimulus, before any new neural run: move the fixed ground view near the same
authored doorway, show a white board behind it, and add a black door-sized blocker
in the comparison. Both cases retain the same room and lighting. The flight pair
and original failed evidence remain unchanged.

The pose is 0.25 metres before the doorway, clear of the authored furnishing
bounds. Both diagnostic meshes use the existing fixture's real depth-tested box
geometry. Neither emits scene light nor changes background lighting. The input
is captured through the existing GPU eye projection/pooling/quantization; no
pixel mask or neural response determines the result. The exact geometry and
pose were chosen and recorded before acquisition in `design.json`.

`capture.mjs` reproduces both inputs through the existing optical worker and
writes raw RGB, source map/profile identities, scene hashes and camera images.
Both Float64 pooling oracles differ by zero byte levels; repeat captures are
identical. The new pair changes 384 compound samples. These are pre-neural
observations, not a successful neural proof or authorization to run a new seed set.

`montage.py` enlarges the unmodified displayed images for review. Its gray surround
only composites the transparent outside of the compound-eye footprint. Fresh
visual review and the native current-bound feasibility check are pending before
incorporating this pair into a new frozen spatial protocol.
