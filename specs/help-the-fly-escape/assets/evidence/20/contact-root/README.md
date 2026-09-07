# Body root and surface witness in the contact diagnostic

The previous fixture queried a downward ray and placed the fly origin at its surface point. That point is not the native hull's supported root. It also changed orientation without recomputing support for the upright comparison. This pass replaces that accidental contract with the existing core SupportSample: both upright and aligned poses carry their own root, quaternion and separate surface witness. It does not adopt a moving hull or food behavior.

The generator uses the committed full native animation-envelope candidate and unchanged authored apple triangles at the same five XZ positions. Renderer and browser harness consume root and rotation directly. Query tests already distinguish the root from its witness; the browser regression now pins that distinction at the displayed model. Changing the renderer to use the witness fails the new root assertion; restoring it passes all19 states and byte-identical reverse seek. Eleven surface tests and the native contact-asset check, typecheck, focused example Clippy and the asset-lab build pass.

## Visual change and review

Before/after full frames and crops preserve all five upright/aligned pairs and nine animation poses. The comparison uses a matching world crop. Upright views change substantially; aligned sample2 also changes visibly. Other aligned states are unchanged or nearly unchanged. The camera still follows the rendered root, so pixel counts include the resulting background shift and are not geometric distance measurements.

Fresh independent review inspected every candidate full image, then every crop, then the baseline. High-confidence improvements: sample0-upright restores whole legs/right wing, sample1-upright restores leg tips, sample3/4-upright restores the left/front leg silhouette, and sample2-supported restores the complete ring and longer visible legs.

Residual findings remain open: upright sample0/1/3/4 rings intersect the fruit; aligned rings are complete. Weak contact shadows and plain shading prevent exact foot-grounding judgment. The three sampled Walk times look identical and do not establish walking motion; Feed and Land visibly change posture. The diagnostic holds the root fixed and therefore cannot validate landing or departure. These limitations remain with20/23/24, not hidden by the fixture correction.

Root inspected the complete capture sheets and crops. Fresh review supports the narrowed verdict: correct native root/orientation binding with visibly reduced clipping, not final microscopic contact or moving-surface acceptance. Resource, camera and physics owners are unchanged. Code review removes the old conditional upright orientation path; the same core query owns both alternatives. The schema uses the existing SupportSample rather than introducing another pose wrapper.

Preview opened10:14:19UTC with corrected sample0-upright, its prior frame, and corrected sample2-supported. The non-blocking window remains open until10:19:19UTC; silence will not count as approval. The separate configured Codex CLI remains unavailable as recorded in the furnishing pass; no successful CLI review is claimed here.
