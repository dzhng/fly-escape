# Wing membrane visibility

The browser's bright floor made the pale membrane nearly disappear, leaving its dark veins above the lower ground shadow. That shadow looked like the wing outline, so the veins appeared to extend beyond the wing. Three.js evaluated vertex positions placed vein endpoints at the actual membrane edge with matching WingL/WingR skin joints. An opaque material diagnostic confirmed the geometry aligned.

The candidate darkens the membrane and raises opacity while retaining alpha blending. [checks.json](checks.json) records the material-only change and proves the full GLB binary chunk is unchanged: no topology, skin, transform or animation change. Three.js r185 loads finite bounds and all four clips after the change. The editable Blender material and regeneration source carry the same values.

[Before](before.png), [close](close.png) and [turned](turned.png) were captured using the production asset-lab replacement input and Extra close camera at 1440×900. [Close crop](close-crop.png) and [turned crop](turned-crop.png) isolate the same fly. These are browser captures, not Blender approximations. The actual membrane edge is now visible around the veins and distinct from its shadow.

A fresh unprimed reviewer inspected both final full images and crops: high confidence that no thin vein lines visibly extend beyond the membranes, no detached fragments, and no attachment gaps or major silhouette defects. It noted medium-confidence polygon bands/stepped edges in the translucent wings, consistent with the existing faceted geometry, and left animated transparency readability for slice 08. This resolves the reported apparent stray-wire defect; it does not close the remaining production motion gates.
