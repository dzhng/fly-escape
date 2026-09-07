# Native envelope browser comparison

**Verdict: the 128-plane representation is the preferred candidate for further
verification; runtime adoption remains unaccepted.** The visual comparisons find
no perceptible grounding, marker, or silhouette regression. Moving contact, body
collision, and WASM workload gates remain open. The [native envelope analysis](../README.md)
owns the construction, geometric error, and heading-sweep measurements.

## Evidence and comparison boundaries

[48-initial](48-initial/) preserves the initial five upright/aligned pairs and
nine animation states. Its comparison reference is the banked
[full-hull contact-root capture](../../../contact-root/after/). The reference full
frames and crops were checked byte-for-byte against the scratch baseline used
during review. [128-expanded](128-expanded/) and [full-expanded](full-expanded/)
preserve matching eight upright/aligned pairs and nine animation states. Each
folder retains full PNG frames, matching subject crops, and capture report
metadata; candidate comparison JSON files hold the matched world-region pixel
metrics. The 48-plane set was compared with the original full-hull captures,
not the later expanded reference.

The reviewer inspected every candidate full frame before its corresponding
crop and inspected the baseline afterward. All captures were inspected directly;
no overview sheet substituted for a full frame. Pixel differences are image
telemetry, not physical support-distance measurements: the camera follows the
root and can shift the background when the root changes.

## Findings and confidence

The 48-plane candidate is visually equivalent in the initial five views and
sampled animation states. No additional leg clipping, body burial, marker gap,
or apparent lift was visible. This favorable view set does not establish
heading-independent fidelity: the native heading sweep reports a worst support
shift of **88.97 μm**. That discrepancy is why these screenshots do not justify
choosing 48 planes.

The expanded 128-plane candidate also shows no perceptible regression. Extra
samples 5 and 6 retain clear legs, complete narrow rings, and consistent alignment
with the visible slope; their supported image regions are pixel-identical to
the full-hull reference. Extra sample 7 retains the same body, wing, and leg
silhouette and complete ring, with ordinary head/wing occlusion. Its 164 changed
pixels produce no perceptible attachment difference. The corresponding upright
views retain their partial ring gaps without additional visible burial or lift.
The original samples and all nine animation states also remain visually
equivalent. The comparison metrics record the small residual image differences.

Confidence is high in visual equivalence for these captures, limited for exact
physical foot contact. Plain surface shading and weak contact shadows do not
resolve every foot's distance from the surface. Upright ring/surface intersections
remain visible. Sampled Walk frames look identical, while Feed and Land change
posture; fixed-root captures do not establish walking, landing, departure, or
moving contact. These are attachment-diagnostic observations, not gameplay
acceptance or a continuous animation containment guarantee.
