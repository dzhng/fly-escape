# Potted plant preparation

Scope: original neutral Blender shape proposal, not production integration or slice 21 acceptance. The target is a readable upright household plant in a grounded closed planter, with distinguishable leaves and no apparent passable floor gaps. Existing Blender scenes were preserved; the exported `.blend` contains only the new asset and its neutral authoring stage.

The source/export envelope is 0.3m wide, 1.05m high and 0.3m deep. The closed planter is 0.4m high and fills the existing square footprint. Leaves are separate closed meshes above it; the proposed visual envelope has **not** entered the catalogue or physical geometry. Foliage collision, visible soil recess contact and browser occlusion remain unresolved integration decisions. Full-height box collision would incorrectly block the visible leaf gaps.

[Round-trip bounds](roundtrip.json), [GLB and image measurements](inspection.json) and [topology](topology.json) establish export evidence: 10 meshes, 5,050 triangles, one neutral material, no skins, animations or cameras. All authored parts are manifold with positive signed volume and no zero-area faces. The common exporter checked native metre bounds before and after GLB import. This does not prove runtime disposal or fly visibility.

Current full captures are [three-quarter](three-quarter.png), [front](front.png) and [rear](rear.png), with corresponding leaves 2x crops. The rejected folder retains earlier captured states. The first version had thin bundled spikes and tight lower framing; the broader version improves blade silhouettes and margins. Its low front camera exposed stage-ground boundaries; the current front camera has a higher viewing angle. Camera changes make pixel distance to rejected images diagnostic only, not an acceptance score.

## Adversarial visual review

Fresh-agent critique was attempted and failed with `agent thread limit reached`. The following is the skill's explicit self-adversarial fallback, not an independent endorsement. All current full views/crops and earlier captured full views were inspected.

- **Leaves:** the strongest case against them is that the central tightly packed forms can read as rigid decorative spikes rather than living foliage. High confidence, all full views and crops. The varied breadth/height and curved outer blades make the plant recognizable as an upright succulent-like study, but organic curvature and separation remain a shape refinement before final 21 acceptance.
- **Edge-on blades:** the tallest leaf becomes a thin bright line in the front view. High confidence, full front and crop. This is real three-dimensional leaf orientation, but the production camera must prove the whole plant remains legible at gameplay zoom; no opacity or size workaround is accepted here.
- **Planter:** the sharp block corners and featureless top can read as a box with a lid. High confidence, all views. The recessed rim and leaf roots convey a planter at authoring scale. Ceramic edge treatment and visible soil remain unfinished; material changes alone cannot excuse a physically misleading top surface.
- **Attachment:** roots meet a small central patch, making the grouping appear pinched. Medium confidence, three-quarter/rear crops. No visible floating gap is apparent, but distributed roots would improve the next shape revision.
- **Grounding:** the dark contact edge and directional shadow support floor contact in all current views. The strongest contrary case is the very sharp planter corner against a soft shadow; this is a neutral staging limitation, not evidence of in-game grounding.
- **Framing:** all current full views contain the whole model. The front crop intentionally isolates leaves and omits the planter base; full images remain authoritative for contact. Rejected low-front views contain visible stage edges; they are not accepted captures.

Verdict: useful prepared asset and measured ownership proposal; final shape/readability acceptance remains open. No claim of photorealism, game integration, correct fly/foliage contact or completed 21.

## Review scope

Refactor review retained the existing shared export validator instead of creating a second exporter. Geometry generation and neutral stage remain local to this asset. Code review checked axis conversion, grounded bounds, closed meshes and omission of stage objects from GLB. Documentation separates appearance proposal from collision ownership and is linked from the house asset hub. Python syntax validation passed. No runtime code or simulation behavior changed, so no runtime regression suite was rerun for this preparation.

The three current full views opened in one Preview window at 09:53:39UTC on 2026-09-07 for a non-blocking five-minute feedback window. The root agent owns closing that window after 09:58:39UTC if proceeding without feedback; elapsed time is not approval.
