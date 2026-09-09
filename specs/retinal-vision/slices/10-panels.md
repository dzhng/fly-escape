# 10 — Paired color eye panels

**Depends on:** 09. **Question:** can the player inspect the selected fly's actual recorded color inputs clearly?

## Contract and seam

Add compact, side-by-side “Left eye” and “Right eye” color previews inside **every fly’s `FlyDetails` view in the right column** of `SciencePanel`, similar to the paired eye insets in the user’s reference demo. Place the preview row above the existing brain-and-traces block, preserving the brain’s existing relationship to its graphs. The previews appear directly when that fly is selected; they are not hidden behind a separate modal, tab or diagnostic mode. All sixteen flies receive this same detail view; only the currently open detail view needs its canvases painted. The small `eye-panels.tsx` consumer takes decoded archive samples, profile and tick; it performs no capture or neural work. Render the RGB8 mosaic with the profile's display transfer function and nearest-neighbor enlargement. A color visualization of rendered samples is not a picture of subjective fly experience.

Use the existing selection owner and playback cursor. At a fractional cursor show the latest recorded input tick at or before it and its acquisition time; never interpolate invented sensory images. With no selected fly, show a concise selection prompt. On a terminal-transition tick display its consumed samples; show unavailable only when the recorded sensory-presence flag is absent. Keep old-replay errors handled as in slice 07. Update stale eight-direction explanatory copy; keep About unchanged.

## Runnable artifact and verification

Add `bun run test:fly-eyes` against the real browser attempt. Exercise running playback, pause, seeks across chunk boundaries, rewind, fly switching, terminal frames, retry and unsupported-record recovery. Visit every fly in the roster and assert its right-column detail view contains both correctly labeled previews bound to that fly’s recorded samples; use distinct per-fly fixtures so stale previews cannot pass. Assert that canvas backing data corresponds to the selected archived RGB bytes after the declared display conversion. The third-person camera must not trigger capture work or alter historical panels.

Capture desktop and narrow-window layouts with visible brain, roster and controls. At desktop width both previews must be visible together inside the right column; at narrow widths keep both within the detail card without horizontal page overflow. Use the accepted feature workbench and preserved `specs/done/neural-vision/assets/browser/vision-details.png` from the integrated baseline as references; copy the latter into `assets/10/baseline/` with its commit/provenance before comparison. Store current screenshots under `assets/10/`.

**Visual variable/crop:** paired-eye legibility and layout, crop the selected-fly panel, plus one whole-frame overflow check. Eye optical calibration, brain-graph redesign, world art and animation are out of scope. Run compare-screenshots against prior layout/reference insets, then unprimed screenshot-critique as the last visual check.

## Verdict and decision budget

Pass when exact historical inputs are readable without clipping existing controls and current-record/old-record states are usable. Delegate spacing, panel dimensions and concise accessible wording within the existing style. Right-column detail-view placement, coverage of every fly, and directly visible paired previews are fixed requirements. Do not add all-fly eye video walls, full-resolution video retention, or a second selection/capture state machine. Preserve setup, scoring, brain view and keyboard interaction tests.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** implemented and verified with controlled recorded RGB, all sixteen selections, rewind, no-sample/black input, camera changes and scrolling. See [panel evidence](../assets/10/README.md). Additional real physical-capture browser evidence and its fresh visual review are underway before marking the slice complete.
