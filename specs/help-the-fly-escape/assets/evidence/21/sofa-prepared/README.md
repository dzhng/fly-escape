# Sofa preparation

Preparation only; slice21 and production/browser appearance are not accepted.
Blender MCP authored original geometry in the existing seat envelope. No
simulation, occupancy, placement, loader or materials-palette code changed.

Three.js GLTFLoader round-trip checks pass: one static scene,8 meshes,
4,176 triangles, one neutral material, no animations, skin, camera or light.
Bounds match1.9×0.85×0.85m with floor Y=0 to less than1e-6m; measured values
are in `roundtrip.json`. Blender library inspection found the separate asset
and stage scenes and11 objects (8 asset meshes, stage floor, camera, light).
The author reads the existing scale fixture instead of declaring a second
runtime occupancy map. Python syntax and asset/source review passed.

The target for the neutral stage was a recognizable two-seat upholstered sofa
with a closed base and distinct front/rear silhouette. All three final frames
and their object crops were inspected. The first authoring attempt used
Blender's default bevel profile0 and produced stepped edges; `rejected/`
retains its three views. Explicit profile0.5 produces rounded cushion corners.
An intermediate normal-refresh attempt and coplanar side-face adjustment were
inspected but their full intermediate frames were not retained. Comparison
metrics cover the retained first attempt and final asset at identical cameras;
this is authoring telemetry, not a production pixel-diff gate.

Fresh screenshot critique could not spawn because the agent thread limit was
reached. Primed adversarial fallback:

- The six-segment corner bands are visible in the full front and rear views;
  the model still reads as a neutral geometric study rather than finished fabric.
- The large plain closed base can read as a hard block; that deliberate closure
  avoids suggesting an under-sofa route, but final upholstery treatment and
  room-scale silhouette review remain required.
- The front stage view exposes the distant ground-plane edge near the frame
  bottom. It is authoring-stage framing, excluded from the exported asset.
- The overall shape is recognizable, with clear arms, paired cushions and rear
  back panel. This supports banking editable preparation, not final acceptance.

Parent handles opening these authoring shots alongside the ongoing review;
there was no user sign-off or browser review during this delegated preparation.
Production per-key loading, matching physical occupancy, replacement disposal,
recorded twenty-fly context and all camera-state browser gates remain open.
