# Bounded fruit cost check

Native profiling found repeated exact hull-bound scans before checking whether any food was nearby. The hull now caches an immutable local box; conservative transformed boxes reject only disjoint food before the existing precise checks. Nearby queries retain the same geometry, ordering, precision and work limits. All 303 serialized frames hash identically before and after, with four escapes. The single native comparison is 9.20→8.87 seconds, a modest 3.5% difference rather than a stable speed guarantee. All 53 focused native gates pass.

On an Apple M5 Pro with 48 GiB RAM, the merged isolated static production build in Chrome 152 completes the same twenty-fly fruit attempt with four escapes, a 1.40-second initial playback wait, 2.05× active-equivalent production rate, zero underruns and frame p95 of 17 ms. Maximum sampled interval is 233 ms. Result and retry are exercised; the harness seeks to the computed result, so this is a startup/integration measurement, not another full 1× playback endurance run.

The preceding 11.24-second fruit wait used the development route while compilation/native probes also ran. Production mode, machine contention and the small culling change differ, so the entire browser improvement cannot be attributed to culling. The isolated measurement removes the immediate startup concern; retain final whole-game/platform and input/combined-memory gates.

Review: the cached box belongs to the immutable ContactHull, no extra spatial owner or history-dependent cache is introduced, and the existing triangle BVH remains the narrow phase. No buffering, neural, geometry, tolerance or budget policy changed. The precise full-frame identity comparison complements the existing near-contact, containment and tangent regressions.
