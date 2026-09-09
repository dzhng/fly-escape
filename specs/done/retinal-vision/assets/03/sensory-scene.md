# Sensory scene contract

`createRetinaWorld` snapshots physical authoring and builds an independently owned `WorldScene`. Its scene identity includes geometry, room floors and details, resolved placements, the appearance portion of the catalog, shared lighting and the generated source/asset revision. Player state and scoring metadata do not enter this identity.

The eyes see the real house openings, walls, floors, authored furniture and room details, and physical placement models. The same asset loaders and lighting resolver build the presentation world. Sensory instances never use player wall cutaways, selected-fly overlays, labels, field discs, placement markers or player scale. Flies and decorative animation are excluded from this static optical world. Shade uses its physical model rather than an invisible field attenuation. Lamps use their authored physical light appearance rather than odor-field rates.

The fixed neutral-asset eye origins and optical axes come from [the rig measurement](eye-rig.md). A full native pre-neural position and unit quaternion place both eyes. Player animation does not move these origins. Projection and clipping are frozen in `retinaCameraProjection`, and the complete rig/projection/layout/photometric description belongs to the exported input profile.

Acquisition renders linear sRGB with no tone mapping and exposure one. Float32 GPU pooling precedes a single RGB8 quantization. Shared authored daylight and fixture colors illuminate the world. Static PCF shadows update once after complete asset loading. There is no autoexposure, runtime spectral reconstruction, exit-bearing signal or camera-relative lighting. Compatible static leaf meshes are batched by material, preserving world transforms and resource ownership.
