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

- **Derive the allowed visual dose from the validated baseline map.** At optical
  initialization, native code totals the existing graph's baseline visual weights
  and checks that both new families together stay within that allowance. It does
  not trust a new map to announce its own larger allowance. The plan fixed the
  shared dose requirement but not where runtime would obtain that bound. This
  keeps the old map as read-only budget provenance; the optical tick does not use
  its directional sensory signal. Removing that provenance at final cutover
  requires another trusted owner for the bound. **Sound, high confidence:** the
  bound is checked against the graph already accepted by native code. Applied in
  native slice-06 preparation.
