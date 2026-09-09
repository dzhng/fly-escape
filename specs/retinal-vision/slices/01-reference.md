# 01 — Reproduce the reference optics

**Depends on:** nothing. **Question:** can we explain and reproduce how the reference turns two cameras into eye samples?

## Contract and seam

Use the exact FlyGym/fly-api revisions in [research](../research.md), in an isolated reference environment. Run the original eye sampler on an asymmetric scene: a marked left/right target, an upper/lower landmark, a moving dark target and colored patches. Do not adopt its hand-written pursuit controller as neural evidence. No product APIs change.

Freeze `assets/01/reference-profile.json`: cameras, source coordinate axes/units, FOV/aspect, projection/distortion, pixel orientation, sampling layout, channel approximation and used-source licenses. Record any reference environment failures and the bounded reproduction attempted. Reading the source alone is not a successful replication. If the original driver cannot run, a small original-sampler invocation on generated camera fixtures is allowed, with its narrower scope stated; do not claim MuJoCo reproduction.

## Runnable artifact and verification

Save an exact command plus pinned dependency recipe in `assets/01/reproduce.md`, camera images, retinal mosaics, known landmark locations and a correspondence report. Commands must run from a fresh temporary environment without changing the product dependencies. Preserve inputs necessary to rerun, not only rendered images.

Check camera handedness, image row direction, up/down, rig transforms and source-to-sample pooling. Color patches must expose channel swaps. Confirm from the controller source that the demo's steering follows a centroid rule. Human artifact: a side-by-side reference contact sheet with numbered landmarks and separate raw-camera/retinal labels.

**Visual variable/crop:** optical projection and handedness, crop each eye interior. Ignore body art, arena design and final panel styling. Compare against the original reference capture using compare-screenshots; finish with unprimed screenshot-critique.

## Verdict and decision budget

Pass when the fixture's landmarks have explained, reproducible mappings and copied inputs have a license ledger. Delegate only environment setup, fixture dimensions and direct coordinate conversion from measured source facts. Camera geometry is then frozen as an optical starting point; its placement on our different fly asset belongs to slice 03. Preserve product tests and runtime dependencies. Human feedback about field of view or recognizable structure can change the later quality profile, not justify reversing eye labels.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status: passed — bounded original-sampler reproduction, 2026-09-09.** [Exact recipe and source/license ledger](../assets/01/reproduce.md), [frozen source profile](../assets/01/reference-profile.json), [contact sheet](../assets/01/contact-sheet.png), and [review verdict](../assets/01/review.md).

The unmodified pinned Retina functions ran on four asymmetric L/R × time camera fixtures. Landmark correspondence, source-derived neutral rig directions, independent pooling, color isolation and changed motion/eye outputs pass; a fresh source-cache repeat reproduced every generated artifact byte-for-byte. Independent pooling differs by at most 6e-15; original uint8 display truncation creates at most one-level differences, retained in the evidence. The final unprimed visual review found the correspondence interpretable and no visible orientation reversal; the original model's weak cyan boundary remains explicitly documented.

This uses the permitted small original-sampler invocation. No MuJoCo render or original demo video was reproduced; rig transforms are checked from source, while actual renderer handedness and articulated/product eye placement remain later optical gates. The original 721-cell green/blue approximation and its ID order are evidence, not the final RGB61 profile. The parent task owns README/choices integration and the non-blocking Preview checkpoint.
