# 26 — Continuous field sampling

Status: implemented and verified; see [evidence](../assets/evidence/26/README.md). Aliasing corrected; physical detector calibration remains open. Dependency: 25 reproduction. Required before physical parameter adoption and 20.

## Contract and owner

Reconstruct the existing cell-centred scalar fields continuously in unobstructed space through `FieldSet::sample_point`. Slice25 proves nearest-cell lookup hides gradients at anatomical antenna spacing. Correct that spatial aliasing alone. Keep grid size, evolution, sources, diffusion, decay, neural equations, cue gain and the five-percent contrast detector frozen. Keep production antenna/body defaults frozen until the corrected probe establishes the next decision.

Use the four surrounding cell centres and bilinear weights. Discard out-of-bounds, inactive, or point-to-centre occluded support and renormalize surviving weights. Reject nonfinite points and points outside open floor or inside solids. Return zero with no valid support. Do not require the old containing cell to be visible first: a cut cell may have another visible supporting centre. The result is linear-exact in unobstructed interior cells and constant-preserving wherever visible support exists. Wall-adjacent support is deliberately one-sided; discontinuities at visibility boundaries are not claimed eliminated. No all-grid search or millimetre grid refinement.

Interpolate attractive odor, repellent odor, brightness and shade with the same weights. Preserve the analytic, room/visibility-gated exit cue and existing wind sampling; do not introduce another field owner or modify transport. Document any no-support edge behavior consistently with the existing field domain.

## Verification and review surface

Unit fixtures pin constant and analytic linear fields, phase continuity across former containing-cell boundaries, exact cell-centre values, nonnegative bounded interpolation, invalid/domain-edge points, walls and solids. Include a cut-cell case where the containing centre is hidden but another support is visible. Keep existing diffusion, mass, advection, sensory and geometry gates green; explicitly explain any old nearest-cell assertion replaced by a stronger behavioral assertion.

Rerun the exact25 anatomical/old-span, boundary/cell-centre, mirrored, neutral and pathway-silenced actual-graph probe with its detector unchanged. Bank compact comparisons and compressed raw evidence under `assets/evidence/26/`. A smooth gradient that still fails the five-percent detector is a separate measured failure requiring a new sensory-adapter contract; it does not justify quietly changing the cutoff here. No campaign batches and no claims of biological validation. Vision shares scalar sampling but this odor probe does not establish vision behavior; include a brightness/shade reconstruction test and retain final adapter validation as open.

This is a numerical seam with a native probe, no visual acceptance claim. If a visual is introduced, apply the standing screenshot-critique and compare-screenshots gates. Review production changes for bounded four-support work and single-owner field semantics before committing.

Delegated: local helper naming and test organization, probe report formatting. Algorithm, frozen parameters and scope are specified above. Update this status and the global handoff with the measured verdict.
