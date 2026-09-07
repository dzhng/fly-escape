# Physical proportions: bounded feasibility result

A 3 mm fly can remain physically small in a 4 m household room and still be inspected in selected macro views. This establishes **scale feasibility only**. Detailed furnished art, supported food/contact, physical/sensory recalibration and general selected-fly visibility are not accepted by this pass.

## Measurement and camera decision

The [scale registry and scoped Blender authoring](../../../../../../assets/proportions/README.md) declare one world unit as one metre. The approximately 3 mm Drosophila reference is [Wellcome Connecting Science / yourgenome](https://www.yourgenome.org/theme/model-organisms-the-fruit-fly/). Room/object dimensions are authoring choices, not sourced biological claims.

The actual fly GLB measures 241.249984 mm across head/thorax/abdomen under the metre convention. A uniform diagnostic factor of 0.01243523 makes that body 3 mm; full rest-pose bounds become 3.861886 × 1.802078 × 3.279793 mm. A nominal 80 mm apple is about 26.7 body lengths across. No core pose, heading or speed is rescaled.

The existing camera's 100 mm near plane clipped both Follow (41.55 mm distance) and Extra close (20.78 mm). `before/` preserves the actual failed views. A distance-relative near plane now includes the real small subject; the ring lift follows model height, and replaced house geometry updates the camera's vertical envelope after cutaways are restored. Overview now fits 2.6 m walls and the neutral 2.1 m doorway lintel. Existing room-fit, follow, tracking, pan and zoom tests remain green; a millimetre-subject regression fails with the former near plane.

The workbench separates Context at 1.2 m from macro Follow, Extra close and whole-room Overview. A whole room and a detailed millimetre fly cannot share one fixed framing. The physical fly is never enlarged to recover readability.

## Preserved failures and physical prerequisites

- **Food-camera occlusion:** fruit-adjacent Follow remains blank because the macro camera can enter the nominal 80 mm apple. Extra close and a different real recorded fly on clear floor isolate successful scale framing. All three fruit-adjacent views remain in `final/`; the food volume/camera case is assigned to slice24's shared occlusion policy. The diagnostic floor composition is not presented as a food-visibility solution.
- **Wide-view selection:** the physically sized ring, like the body, becomes subpixel at room Overview. A minimum screen-space selection cue belongs to furnished readability; do not enlarge the fly itself.
- **Physical body:** the old core radius is 80 mm. The authored *rest-pose* AABB corner radius is 2.631336 mm; that is not an animation-safe collision envelope. Sample posed vertices and choose any required margin explicitly in the physical-scale calibration seam.
- **Sensory anatomy:** authored tip centres relative to the grounded model origin are approximately X=±0.202073 mm, Y=1.484890 mm, Z=+1.414508 mm (+Y up, +Z forward). Their separation is 0.404145 mm. These are authored landmarks, not new biological measurements. Current field samples are ±150 mm laterally about the body centre and use a 250 mm grid in this fixture. Forward/height offsets, sampling semantics and the frozen 5% contrast detector must be measured together before new parameter values are adopted.
- **Other units:** movement speed, tool/contact footprints, support height and field resolution need the same declared unit convention before calibration. The earlier large-body results are retained scientific diagnostics, not evidence for a physically small furnished campaign.

## Actual-browser proof and review boundary

`final/report.json` contains the actual camera/model/anatomy measurements and a forty-tick recording from twenty independent real-connectome bodies through the existing Worker/Attempt/FrameArchive. The seed and graph/build identities are retained. The fixed controlled start is explicitly diagnostic; natural campaign starts belong to18. The recorded frame contains twenty bodies and 800 accumulated neural steps. No contact benefit or navigation success is claimed.

`tests/browser/proportions.mjs` drives the real workbench views and recorded seek, captures eight full frames and four crops, and checks twenty recorded bodies, neural progress and absence of page errors. Use `PROPORTION_URL` and `PROPORTION_EVIDENCE` to target a local workbench and preserve a candidate. The app typecheck, asset-workbench build and 31 renderer tests/198 assertions pass. The exact built workbench also completed the same 40-tick browser probe, and all twelve built PNGs match the reviewed set byte-for-byte; see `built-comparison.json`. The workbench shares the game’s prepared public graph directory rather than maintaining another graph source. The only ordinary renderer changes are near-plane scaling, ring height and replaced-house vertical fit; production model/house/tool validators are unchanged.

Independent parent source review approved the bounded camera/index/test changes. Its disclosed **primed adversarial visual fallback** inspected all eight full frames and four crops: clear-floor macro clipping and tall-room framing are corrected, adjacent-fruit Follow and wide-view selection remain concrete failures, and diagnostic labels prevent these proxies being mistaken for finished art. After the lintel correction, only Overview and its crop changed; those were re-inspected and all other ten PNGs were byte-identical. This verdict accepts only proportion feasibility, not general Follow visibility or furnished realism. A separate reviewer was requested; no unavailable review is counted as completed.

The parent coordinates the human Preview window after its active slice18 window; this branch opens no competing Preview set. Integration and that checkpoint remain with the parent.

Decision audit: metre units and a biological-size body expose physics/sensory mismatches instead of hiding a giant invisible body. The temporary composite avoids anticipating a permanent furnishing API; closed-base envelopes avoid false under-furniture routes. The failed adjacent-fruit case is retained rather than moving the fruit to obtain a favorable image. Materials, lighting, core equations and thresholds stay fixed.

## Root integration

The diagnostic now uses explicit Fixed starts and the archive's authoritative initialBodies/tick-zero frame from18. Root also corrected its presentation tick duration from0.02 to the actual0.1 seconds. Frozen install, typecheck,31 renderer tests, both app builds and the actual built40-tick/20-fly Worker probe pass. No simulation parameters were changed.

Eight integrated PNGs are byte-identical to the reviewed candidate. Four changed images and their hashes are retained under `integrated/`; root viewed all changed images and the other exact images were already inspected. Adversarial fallback: a new tick-zero pose could clip or displace the model, but both macro views retain the complete fly and ring; recorded playback could stop following, but the final recorded state remains centered with a valid20-fly neural frame. Known apple occlusion and subpixel wide-view selection remain24 failures. This is a disclosed primed review, not a fresh-agent claim.
