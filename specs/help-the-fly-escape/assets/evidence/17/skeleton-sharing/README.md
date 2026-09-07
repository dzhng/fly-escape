# Shared skeleton resources within each fly

Priority: bounded resource/work amplification, not an unbounded leak. The native
GLB's40skinned meshes share one23-bone skeleton. The library clone helper creates
40skeletons per cloned fly despite identical remapped bones and inverse matrices.
The twenty-fly production fixture therefore allocates761bone textures, contributing
to764total renderer textures. Each duplicate also repeats the same skeleton update.
The source/clone identity probe and production shape report establish the cause;
these counts alone do not establish a frame-time regression.

The natural owner is the existing library clone helper: preserve source skeleton
sharing within one cloned hierarchy while keeping different flies independent.
Use the existing pinned-version patch rather than add a second clone algorithm to
the application. Acceptance requires equal animated vertices/pixels, independent
poses and fewer actual renderer textures, with disposal and replacement preserved.
No model, physics, library version or animation timing changes are intended.

Verification: the real-GLB regression failed before the patch (40 clone textures versus1 source) and passes after it, checking all four animation clips, independent poses and reverse seeking. The renderer suite passes37tests/461assertions; TypeScript and the asset-lab production build pass. A separate empty project installed Three0.185.1 with the cleaned patch using a fresh Bun cache and reproduced one source/one clone skeleton with23independent bones and distinct textures. Generated Bun metadata was removed from the patch.

The [before report](before-report.json.gz) and [after report](after-report.json.gz) measure764→23textures with unchanged1801draw calls,250940triangles and119geometries. Six replacement cycles remain stable, errors are empty and delayed loads/reverse seek pass. All20 corresponding full/crop PNG files are byte-identical; [SHA-256 comparison](pixel-identity.json) records each. Images are therefore not duplicated here; the accepted [shape captures](../../21/browser-shapes/README.md) show this appearance. These are resource and equivalence results, not measured FPS improvement or final release memory acceptance.

Independent source review found the clone ownership sound and requested only removal of Bun metadata and updated patch rationale; both are resolved. The map belongs to each clone invocation, and each mesh still binds its own matrix. Repeated skeleton disposal clears its texture once. No extra application disposal owner was added.
