# Renderer lifetime patch

The Three patch gives each WebGL renderer ownership of its internally supplied DFG lighting texture. Its immutable lookup data remains shared, while disposing a renderer removes that renderer's texture listener and GPU upload. Broadcasting disposal on the shared texture would also invalidate other live renderers; forcing context loss alone would leave the JavaScript listener chain intact.

Bun applies the version-specific patch from the root manifest and lockfile during installation. It covers the package's exported ES module and CommonJS builds as well as corresponding source. Keep those forms coherent; remove this patch only when an upstream version passes the same lifecycle regression.

The [measured failure and verification](../specs/help-the-fly-escape/assets/evidence/17/renderer-lifetime/README.md) distinguish the repaired canvas/texture retention from remaining main-heap growth. No application disposal wrapper is required.
