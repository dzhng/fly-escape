# Motion candidate preparation

Slices 07 and 08 remain open. This pass prepares an editable skeleton and clips; it does not establish production playback, camera-distance readability, ground contact, seek/pause behavior, clip blending or browser cost.

The [Blender source](../../../../../assets/fly/fly.blend) and [GLB](../../../../../assets/fly/fly.glb) retain the static candidate's mesh coordinates and three materials. Each mesh has rigid weights on one bone, so body surfaces do not stretch during joint rotation. A shared skeleton permits future mesh consolidation if browser measurements justify it. No batching or LOD is added. [animate.py](../../../../../assets/fly/animate.py) runs after the static geometry authoring script; the checked-in Blender source includes the neutral review setup.

## Clip contract

| GLB name | Duration | Playback |
| --- | --- | --- |
| Walk | 1 second | Loop; alternating tripod lift and swing |
| Fly | 0.5 seconds | Loop; raised legs and two stylized wing strokes |
| Land | 0.8 seconds | One shot; legs lower and wing amplitude decays |
| Feed | 1 second | Loop; head dips and proboscis extends |

Clip names are the stable NLA track names. Blender may suffix internal object/action datablock names when another source is open; consumers should use exported clip names and the scene root, not an incidental Blender suffix. No clip targets FlyRoot or FlyRig, and no clip supplies world translation. Simulation owns movement and body height. Land should clamp after completion; runtime transition timing and blending still belong to slice 08.

The wing cadence is visual stylization, not literal biological frequency. Its arc stays above the resting wing plane to avoid the raised legs. Feeding extends the proboscis up to three times its resting length to make the gesture readable; this is a reversible animation exaggeration, not a claim of anatomical accuracy. Food/contact framing is still needed for final feeding acceptance.

## Evidence and limits

[roundtrip.json](roundtrip.json) records the final GLB hash, budgets and direct decoded animation checks. Walk, Fly and Feed have exactly equal first/last exported channel values; Land intentionally differs. No root node is targeted. All four clips successfully imported through Blender MCP. The [source inventory](source-inventory.json) was read from the saved library and contains only the fly scene, skeleton, four actions and review setup. Mesh-local coordinates compared exactly equal to the static source.

The nine PNGs in this directory render the imported GLB, using frame numbers in filenames at 30 frames per second. They cover two walk poses, two flight poses, landing start/middle/end and two feeding poses. Blank neutral backgrounds establish attachment and deformation only; they cannot prove foot contact or floor clipping. Import with `disable_bone_shape=True`: Blender's optional bone-shape creation uses active UI context and is inappropriate when other work is open.

The fresh reviewer inspected the complete earlier candidate set and found no detached joints, torn body surfaces or wing–leg intersections. Walk poses differed with stable attachment; landing ended near the rest silhouette. Its actionable findings were weak feeding readability, far-side legs hidden behind the eyes, an edge-on flight wing and unproven ground contact. Feeding was then strengthened with proboscis extension and all nine final round-trip stills were inspected again by the author. A second independent pass could not start because the team thread limit was reached, so final independent visual acceptance remains explicitly pending. Far-side occlusion and the brief edge-on wing remain camera/motion readability checks for the production asset lab.

Shape and diff review preserve one skeleton and one motion authoring script; no renderer, application or simulation owner changed. The source uses scoped library saves, with no unrelated Blender scene or action in the saved artifact. Export is scoped to the fly scene and its geometry/skeleton; NLA-track export avoids Blender's global compatible-action search.

Three.js r185 also loads the candidate with finite initial and animated bounds across sixteen clip samples, including a separate clamped landing-end check. Descriptive ground-contact metadata uses `ground_contact_description`: `extras.pivot` is reserved by this loader for a numeric pivot vector and a prose value produces NaN transforms. The metadata repair preserves the complete GLB binary chunk, including geometry, skin matrices and animations. Blender-only round-trip inspection did not detect this consumer-specific collision.
