# 08 — One-fly spatial and brightness proof

**Depends on:** 07. **Question:** do eye location, occlusion and intensity affect downstream neurons through the real complete path?

## Contract and seam

Run the one-fly workbench through capture → RGB samples → frozen adapter/map → Brain → recorded body, using actual retained graph identities. Keep chromatic channels neutral for the primary spatial/brightness comparison so this slice asks one causal question. Export its exact eye batches for native/WASM comparisons.

Pre-register a bounded experiment before inspecting results: fixed pose starts, stimulus positions/intensities, seeds, duration, downstream population and contrasts. Exclude injected cells and motor readouts from the neural endpoint. Reuse applicable existing neural-vision analyzer machinery rather than inventing a parallel statistics framework. Do not reuse the previous eight-bin pass as proof for the new input.

## Runnable artifact and verification

Provide `bun run probe:retina-neural` with its reproducible manifest in `assets/08/`. Include dark/uniform scenes, left/right and upper/lower matched patches, a physical blocker/opening pair, intensity sweep, identical-byte repeat, zero-input and input-silencing controls. Background light remains equal in blocked/open conditions; do not expect a real lit room to equal a completely dark fixture merely because one lamp is occluded.

Validate optical landmarks and current changes first, then repeatable responses beyond injected neurons under the frozen contrasts/multiplicity policy. Identical eye bytes and seeds must give the same measured neural input; camera/UI changes cannot alter results. Silencing the visual input must remove the stimulus-dependent difference under otherwise identical conditions.

Record movement observations separately, including negative or inconsistent results. No gain/axis/seed search for escape success and no direct steering correction are permitted.

**Visual variable/crop:** stimulus/current/downstream correspondence in the workbench, crop the eyes and aligned plots. Compare each controlled stimulus with its fixed baseline and finish with unprimed screenshot-critique.

## Verdict and decision budget

Pass with repeatable prespecified spatial/intensity contrasts and exact controls. Delegate bounded experimental sample size/duration based on the existing analyzer's power/runtime constraints, recording the choice before running; endpoints and exclusions cannot be changed after seeing results. Failure may be optics, map, dynamics or insufficient evidence—diagnose rather than asserting the map alone is wrong. Keep all integration and record tests green.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** failed under the original frozen protocol. Diagnostic and held-out results remain in [evidence](../assets/08/verification.md). The [input-only reslice](../assets/08-reslice/proposal.md) strengthens stimuli without tuning neural parameters or exclusions; its reserved-seed run awaits final cutover source freeze. The production one-fly workbench and cross-target comparison are in progress.
