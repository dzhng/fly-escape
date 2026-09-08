# Zoom-dependent fly readability

Target: recognize actual fly models at room Overview, with native close-up appearance and unchanged physical trajectories. The common camera-derived scale targets a 24 CSS-pixel longest span at target depth. Perspective and orientation still affect projected size.

## Checks

32 renderer tests and TypeScript check pass. Production web build passes. The new camera test fails when compensation is disabled and passes restored; it covers continuous zoom, stable repeated evaluation, native close scale and resize preserving the followed subject's screen size.

The proportions browser checks 20 real-connectome flies, mesh picking from compensated context, return to the same camera state, stable repeated frames, and identical recorded poses/camera after reverse seek. Core antenna alignment is checked at native close scale. The production playback camera suite passes card/model selection, close zoom, Overview, pan/unfollow and keyboard navigation. The production route trail probe uses seed42 at ticks10.3 and30.5: pause and reverse seek restore exact canvas bytes in close and Overview, without browser exceptions. No performance claim is made from these checks.

`comparison.json` compares the same 1120×794 world crop and tick against slice25: Overview changes4151 pixels and context13135; follow and extra-close change zero pixels. The candidate is less wrong for wide-view readability; the native close appearance is preserved exactly.

## Adversarial visual review (primed fallback)

No fresh reviewer was available after the recorded agent usage failure. This is the skill's primed adversarial fallback, not an independent review. Full proportions states and selected/swarm crops were inspected, together with production playback close/Overview.

- Strongest case against Overview: overlapping wings in the compact swarm obscure individual silhouettes. Verdict: bodies, red eyes and wings are now identifiable instead of subpixel; accept the readability improvement, preserve physical positions and use close selection for individual inspection.
- Strongest case against the ring: the dense swarm puts neighboring wings across its edge. Verdict: the yellow outline is still visible and correctly surrounds the selected displayed body; context and close states are clear. No black/blue decoration appears.
- Strongest case against close-up: enlarging display geometry could make the original native framing oversized. Verdict: both native follow and extra-close world crops are pixel-identical to baseline.
- Strongest case against trails: white paths are faint at close zoom and short traces disappear within the inflated footprint at Overview. Verdict: the gap follows displayed size and reverse-seek pixels are stable; no new trail-contrast improvement is claimed. Reassess contrast against final house materials.
- Strongest case against nearby food: the fruit-adjacent follow frame still obscures the subject. Verdict: this pre-existing contact/occlusion defect remains assigned to20/24; wide display inflation does not resolve it.

Preview opened2026-09-07 04:42:51UTC with Overview/context/close. Closed after the five-minute non-blocking window without new feedback. Root proceeds on the recorded technical/visual verdict; silence is not user approval of final house art.

## Code review

Root reviewed projection ownership, native-transform preservation, scaled raycast geometry, selected-centre tracking, ring thickness and trail exclusion. No compatibility path or physical scale mutation was added. Independent Codex CLI review remains unavailable for the configured model, as recorded in the prior implementation handoff; no independent code-review claim is made.

## Scope

Only renderer scale, its selection/follow/trail consumers and diagnostic labels change. Native assets, bodies, sensory positions, fields and recordings retain their physical values. The neutral proxies and current diagnostic layouts are not the two final authored levels.
