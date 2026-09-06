# Shadow artifact experiment

Target: room and solid faces show their surface color without diagonal self-shadow stripes; flies and props retain contact shadows. Camera, meshes, palette, animation, light placement/intensity and shadow resolution are frozen. The only runtime change is the directional light depth bias.

The -0.0001 candidate changed pixels but left visible stripes. An independent reviewer inspected the paired full frames and rejected a meaningful-improvement claim. The -0.001 candidate removes stripes from the stopped upper-right wall and the detour wall/solid faces while preserving floor contact shadows and geometry silhouettes. The same reviewer inspected all three primary views and four paired enlarged face crops; no new blocking contact or color defect was seen. Root agrees after full-frame and wall-crop inspection. Comparison telemetry retains the failed and successful candidates; the successful stopped distance is 0.00382 and detour 0.00837, small localized changes rather than whole-scene relighting.

The real production attempt also passes six exact pause/reverse captures with twenty flies at close and Overview. A separate thirty-second playback profile on hardware ANGLE Metal / Apple M5 Pro records 1,801 frames and 16.7 ms p95 frame intervals. This is a bounded shadow regression profile, not the ten-run full-episode performance acceptance gate. Geometry/worker probe and disposal assertions remain green.

Source/shape review: one scalar in the existing light owner; no additional pass, resource, dependency or clock. Depth bias is delegated tuning in slice 12. The loaded Three.js LightShadow source documents depth bias as the appropriate small normalized-depth adjustment for shadow artifacts; [Three.js shadow guidance](https://threejs.org/manual/en/shadows.html) explains the map-size/coverage tradeoff avoided by keeping resolution unchanged.

Verdict: accept the narrow wall self-shadow correction provisionally. Complete slice 12 still needs authored production house/food composition, exit emphasis and the final human window. No claim that this one setting completes the lighting slice.

Final independent lighting review inspected all six production views, five solid views, and seven actual food-context full/crop frames plus their sequence. No blocking lighting, depth, grounding, marker or exit defect was found. The orange exit remains discernible without adding another light. Soft small leg shadows and floor-colored radial fruit gaps are nonblocking limitations; the latter belongs to asset silhouette. The final human window opens at 19:34 UTC for approximately five minutes.

The final human window closed at 19:39 UTC without a course correction. Root accepts slice 12 from its localized shadow comparison, complete production/food visual review and hardware profile. No additional light was needed: the existing warm orange exit marker remains readable. Future campaign composition still checks these components together.
