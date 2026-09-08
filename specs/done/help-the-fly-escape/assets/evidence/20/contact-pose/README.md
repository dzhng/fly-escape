# Native support pose in the browser

The target is one native fly whose root and orientation come from the same Rust surface query as the visible mesh. This is a fixed contact diagnostic, not a neural attempt, physical trajectory, or accepted final food hull.

The production renderer now consumes the core quaternion (four rotation components), including its follow centre and yellow selection ring. Upright poses reset previous tilt. The geometry example generates `assets/proportions/contact-fixture.json`; `tests/browser/contact.mjs` exercises the asset workbench against it. The original five samples matched the exported ray point and quaternion and remained centred within one CSS pixel. The [root correction](../contact-root/README.md) later found that the ray point was incorrectly treated as the body root; these original images validate orientation binding, not native hull support. Walk, Feed and Land clip samples render, and reverse seek restores exact canvas bytes. The production playback camera suite also passes model/card selection, zoom, pan and keyboard behaviour; its completed `checks.json` has no browser errors.

## Visual comparison and limitations

The complete capture set includes five upright/aligned pairs and nine animated poses, with full frames and tight crops. `comparison.json` measures identical 320-pixel square subject crops at each support sample. Changed pixels range from 28,330 to 98,815; the real orientation change is visible. Follow targets move with the rotated native centre, so these are attachment comparisons, not fixed-world-camera geometry error measurements.

Fresh agents remain unavailable due their reported usage limit. This is a primed adversarial fallback, not independent review:

- Strongest case against attachment: the nearly uniform surface and weak contact shadow conceal small floating or penetration gaps. Verdict: accept core-to-renderer orientation binding only; screenshots do not certify microscopic foot planting or the final hull.
- Strongest case against the ring: the far-slope ring is narrow in projection and wings cross it. Verdict: its support plane is correct and its outline remains visible; the upright comparison loses part of its ring beneath the surface.
- Strongest case against animation: the Land frames hold a fixed root, so they cannot demonstrate a real landing. Verdict: accept deterministic clip attachment only; descent, departure and food replenishment still require body integration.
- Strongest case against shape quality: the surface outline and fly body are visibly faceted. Verdict: no final asset/material acceptance; these images isolate support orientation.
- Strongest case against the flat playback regression: the wide fixed-start swarm overlaps and the close frame has no room context. Verdict: camera selection and native close framing remain intact; final furnishing and swarm readability remain their existing later gates.

All full frames and crops were inspected, including the production camera montage. Preview opened at 05:47:22 UTC and closed at 05:55 UTC on 2026-09-07 after the non-blocking feedback window without new feedback. Proceeding reflects the technical verdict above, not user approval of final art.

## Review

Shape review keeps orientation in the core and projection in the renderer. No new controller or physics dependency is added in this pass. The permanent lab uses the production renderer and generated core output; the capture harness pins actual root/quaternion values and rendered reverse seek. TypeScript, four core surface tests, strict core Clippy and 32 renderer tests pass. Independent CLI review remains unavailable for the configured model; root reviewed the diff, resource cleanup, native-transform reset and docs. Full slice20 remains open.
