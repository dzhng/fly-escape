# Choices made during implementation

## Provisional, least confident first

- **Visible-color approximation:** rendered blue drives the retained Tm20 population; weighted RGB brightness drives Tm2. Published physiology supports the family-level distinction, but the numeric weights and saturation are modeled. This preserves a separate color dimension without claiming that a screen RGB value reconstructs a fly's spectrum. Accept the frozen hypothesis for the spatial map and controlled downstream experiment; slice 09 must establish its effects before release.
- **Missing color-cell positions:** exclude Tm5 and three Tm20 cells without source columns. Inventing positions would falsely imply spatial evidence. This reduces coverage; slice 05 must expose the holes instead of stretching the remaining cells.

## Settled

- **Reference reproduction boundary:** invoke the original pinned sampler on generated asymmetric camera fixtures, as the spec permits. This independently checks channel handling and projection without importing a MuJoCo runtime. It does not establish that our final room capture matches the original demonstration.
- **Reference display:** retain the original green/blue false-color display in reference evidence, including its documented weak cyan boundary. Its discarded red channel is not copied into the product's RGB sensory path.
- **Coordinates:** translate the reference axes through a proper rotation into the game's body axes. Eye labels follow physical sides, not whichever asset mesh suffix appears to say left. The actual asset rig is being verified separately.
- **Color budget:** both visual families share one bounded dose. Uniform blue changes at equal brightness are diagnostic only because they change total current; the proof must use spatially counterbalanced colors with equal support and total dose.

- **Real retained resolution:** select 128×128 acquisition and 721 RGB samples per eye after the user and independent reviewers rejected 61-cell views. GPU pooling makes the larger profile practical. The 256-pixel reference adds fine contours without materially improving major-boundary recognition; 721 cells give margin over the usable 469-cell profile. This is a measured engineering choice, not a claim of biological acuity.
- **Canonical pooling:** use Float32 GPU linear-light sums and quantize once to RGB8 before transport. Retain these exact bytes through neural input and replay; a Float64 CPU oracle permits at most one quantization level difference and never replaces the runtime output.
- **Replay budget correction:** the earlier 128 MiB ceiling was our assumption. The user delegated practical sizing. Adopt 512 MiB as an engineering target, preserve explicit overflow behavior, and verify full campaigns before claiming completion. Do not ask the user to reconfirm this routine limit.
- **Batch ownership:** combine compatible leaf meshes by material only after physical authoring is frozen. Independent worlds retain their own mutable assets. Merged geometry is independently disposed; source materials stay with their loader owner. Excluding mesh parents preserves unmerged descendants.
- **Two failure deadlines:** a worker fence timeout handles GPU nonprogress; a main-thread watchdog also handles a stalled worker event loop. Any failure rejects the batch, and explicit user retry constructs a new capture. No stale or black optical fallback.
## Native tick preparation — sound

- **Preserve the map export's text when loading it.** When the worker fetches the
  map, it passes the original JSON text to native code. The loader checks the
  profile, layout and color descriptions against their SHA-256 identities using
  their exact exported text. Parsing and rewriting that text first can change
  how a decimal is written and is therefore rejected. The plan required identity
  checks but did not choose how two languages would agree on number formatting.
  This avoids maintaining a second cross-language JSON formatter and binds the
  actual reviewed artifact. Future consumers must load it as text. **Sound,
  medium confidence:** a deliberately narrow deterministic artifact interface;
  semantic reformatting is not supported. Applied in native slice-06 preparation.

- **Bind the visual dose to compact source metadata.** Native initialization checks the archived baseline map hash, annotation hash and original graph hash, then enforces the frozen aggregate weight sum. The source registry owns this scalar and refuses to relabel it for a changed graph. This replaces runtime retention of old directional weights while preserving their exact dose allowance. **Sound, high confidence:** the new exporter regenerates the existing retinal map and current fixtures byte for byte, and publication validates the map before overwriting output. No legacy visual sample participates in the retinal tick.
- **Reuse existing visual activity groups.** The two visual groups now contain all mapped Tm2 and Tm20 cells by eye, preserving the sixteen-group record capacity. **Sound, high confidence:** panel labels describe the actual injected population without adding a second set of visual groups or expanding every recorded frame.

## Shared optical world integration — sound

- **Snapshot physical authoring before asynchronous loading.** Scene identity and meshes consume the same copy; later caller mutation cannot relabel a different scene. Appearance catalog fields exclude scoring and chemical effects. The generated revision follows renderer imports and assets so visual source changes invalidate identity. High confidence, tested by mutation and provenance regeneration.
- **Share the authored lighting resolver.** Daylight direction belongs to campaign authoring and resolves against the room envelope, not an escape trigger or asynchronous mesh bounds. Fixtures use the same physical light owner. This closes the diagnostic-lighting shortcut without changing campaign light direction. High confidence from paired production images and lamp movement.
- **Keep sensory geometry static and independently owned.** Exclude flies, decorative animation and presentation overlays; keep real openings and prop surfaces. The same world factory and loaders serve both modes. Static compatible leaves are batched only after assets finish. This implements the permitted exclusions and prevents the player camera changing input. High confidence from byte invariance and independent visual review.

## Browser rendezvous integration — sound

- **Make initialization cancellable at fetch ownership.** Pass one attempt-owned abort signal through every physical asset loader and map fetch. Late loaders release results; native ownership is freed when cancelled initialization settles. A failed cleanup retires the whole worker. This addresses measured hangs without a second initialization manager.
- **Track outstanding credits when interpreting idle.** A queued idle notification can arrive after the client sends fresh credits. The client retains its watchdog until those granted chunks return; it does not trust a stale idle label alone. The injected ordering regression reproduces the prior missing deadline.
- **Revalidate map downloads on each attempt.** Do not retain unvalidated text or rejected map promises in the worker. HTTP caching remains the resource owner, and explicit retry can recover from a corrected response. This is cheaper and easier to keep correct than another success/invalid/pending cache state machine.
- **Keep RGB payloads out of component props.** Development profiling expanded one changed swarm batch into 138,625 entries per update and eventually crashed. The archive still holds every exact byte; the playback frame reader can omit retinal materialization, and eye painting reads only its selected fly. The measured fix reduces the largest description to 3,236 entries. No profiler monkey patch ships.

## Replay and neural reslice — provisional and sound

- **Retain a failed experiment and choose stronger inputs before rerunning it.** The original location patches moved too little mapped current to establish the required downstream effects. The revised proposal selects spatial supports and colors using only image/map/current evidence, retains every original contrast and exclusion, and reserves new seeds. It changes the stimulus question without rewriting the original negative result. **Provisional, medium confidence:** stronger input contrast is justified; downstream evidence remains unestablished. The fixed adapter, dose ceiling, neuron endpoints and multiplicity policy must not change after the freeze.
- **Use a separate elevated-luminance context for the repeated color contrast.** The proposed RGB pairs preserve the exact chromatic current difference across two brightness contexts; the second context is an additive change in red/green, not a multiplicative brightness scale or constant chromaticity. **Sound, medium confidence:** it tests context replication with exact native controls, but must be labeled accurately rather than described as doubled color brightness.
- **Expose eye presence through archive metadata.** The panel checks whether an input exists before creating its canvases, and reads the selected eye bytes only while painting. A true black input remains an image; absent history gets an explicit no-sample state. **Sound, high confidence:** presence does not depend on pixel values and selection does not materialize every fly's RGB.
- **Use a longer diagnostic horizon without editing campaign timers.** Resource stress runs exercise both authored rooms for 6,000 ticks, including the room whose playable duration is shorter. **Sound, high confidence:** this resolves conflicting planning language by preserving authored gameplay and reporting the stress horizon explicitly.
