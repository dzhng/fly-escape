# Yellow marker readability review

Target: a single yellow world ring identifies one selected fly in the unchanged dense overview while preserving the close framing, world perspective and model scale.

## Evidence

The production build on isolated port 5296 uses the committed GLB and copied, unchanged graph/WASM artifacts. Both [before](marker-before/checks.json) and [after](marker-after/checks.json) camera runs pass selection through model/card/keyboard, centering, low-card visibility, zoom bounds, pan release and Overview behavior. Typecheck and all five renderer tests (39 assertions) pass. No simulation or authored asset changed.

At the same 1440×900 viewport, seed and paused tick-zero cursor, [pixel comparison](marker-after/pixel-diff.json) finds exactly 43 changed world pixels, within a 10×8 rectangle around the overview selection. The four follow/close world images are pixel-identical. Worker computed-time text may differ outside the world crop because production runs independently of the paused playback cursor. An added interior-fly overview verifies association with neighbors on both sides. Every candidate state and a 4× subject crop are retained in [the capture folder](marker-after).

The candidate is less wrong: the visible yellow stroke singles out the last body without enlarging the ring around its neighbors. Close body/wing/leg detail and the original thin ring stay unchanged. This verifies grounded selection at the recorded camera states, not airborne marker association or every future viewport.

## Independent review

A fresh reviewer inspected all five original candidate full frames before all five crops, then the added interior overview and crop. The final interior capture also isolates a middle-row body without enclosing either adjacent fly. The marker is detectable in overview, unambiguously selects one body and agrees with ground perspective; translucent wings correctly show the ring beneath. No marker defect, unexpected selected-body clipping or depth inversion was found. Remaining observations are small model detail at overview, faint shadow stippling at close range, and neighboring flies clipped by follow framing. The selected subject remains fully framed; shadow polish belongs to lighting rather than this bounded stroke change.

Independent code review found no correctness defect: the outer rim stays fixed, inner vertices derive from it without cumulative drift, and each selected render performs bounded work independent of population. The CLI review was also retried but failed with a model/client-version 400 before reviewing code; the independent agent review supplies the second opinion.

Shape/diff/docs review is clean. The ring remains renderer-owned and uses the existing camera projection; no second camera math, fixture correction, extra marker, shader or resource lifetime was introduced. The production change is 25 added lines net. The pre-implementation [marker decision](../../../README.md) records the material choice. The choice to thicken inward keeps one-fly association; retaining a central hole keeps the cue a ring. Reusing the existing mesh limits GPU work to its existing vertex buffer.

## Acceptance boundary

Grounded overview stroke readability is verified. Overall slice 06 and its dependency 05 remain open. In the later animation integration, a selected airborne fly can project above its ground ring, leaving the circle visually between other flying bodies. The existing ground-anchor assumption needs a separate explicit selection-contract decision; this pass deliberately preserves it and makes no claim that airborne association is solved.
