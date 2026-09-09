# 09 — Chromatic downstream proof

**Depends on:** 08 and the frozen slice-04 hypotheses. **Question:** can a color difference, rather than brightness leakage, change downstream neural activity?

## Contract and seam

Use the same pipeline and accepted geometry as slice 08. Change only stimulus color. Preserve RGB8 in the archived input and show the actual color patches/mosaics. Freeze the adapter, target populations, gains and seed list before running. The endpoint is downstream activity, not injected-cell differences or a preferred turn.

## Runnable artifact and verification

Add `bun run probe:retina-color` using a feature-owned experiment manifest and the existing analysis owner. Place spatially identical patches with different colors at matched declared linear-light luminance. Verify brightness-branch equality after actual quantization and adapter conversion, not just equality in authored RGB values. If exact equality is impossible, bound the residual and include a brightness-only perturbation of that size.

Repeat color contrasts at multiple intensities within the declared supported gamut. Include identical-byte controls, grayscale/chromatic-off ablation with brightness held fixed, visual-input silencing, left/right counterbalancing and total-injected-dose reports. Add matched-total-dose contrasts where supported to distinguish the distribution of activity from globally stronger stimulation. Measure beyond every directly injected population; report all prespecified seeds/contrasts and apply the frozen multiplicity policy.

Track three distinct observations: RGB changes, mapped neural input changes, downstream neural response changes. The first two alone do not pass. Observe motor changes separately without tuning. No arbitrary RGB-to-cell partition or invented UV channel can be justified by a successful significance result.

**Visual variable/crop:** chromatic contrast with matched brightness, crop paired patch/eye interiors and aligned response plots. Use compare-screenshots to expose hue loss/channel swaps; the decoder/adapter equality assertions establish brightness control. Run unprimed screenshot-critique last.

## Verdict and decision budget

Pass with a source-supported frozen approximation and repeatable downstream chromatic contrasts that survive the brightness controls. No guaranteed magnitude or specific color preference is implied. Delegate analysis implementation using the existing framework and numerical fixture adjustment to meet declared brightness tolerances before runs. A failed color gate requires reslicing; grayscale completion is explicitly forbidden. All spatial, record and cancellation gates remain green.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** planned; no implementation or verification result yet. Record the exact artifact, tests, observed limits and pass/fail verdict here when executed, then update the README handoff.
