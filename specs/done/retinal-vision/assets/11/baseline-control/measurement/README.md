# Paired cost and budget reconciliation

The higher-detail eyes have a material cost. These measurements do not establish a universal slowdown or speedup: they are one fixed-order baseline → capture-only → final run per room, without repetition or uncertainty bounds. Both capture-only controls reproduce every packed baseline record and outcome exactly. The capture-only worker waits for real physical acquisition at the recorded baseline body poses, then advances the unchanged old core; it discards those RGB samples.

| Diagnostic 6,000 ticks | Baseline wall | Capture-only wall | Final wall | Final / baseline |
| --- | ---: | ---: | ---: | ---: |
| Room 0 | 92.303 s | 136.495 s | 150.256 s | 1.627862× |
| Room 1 | 171.641 s | 151.852 s | 151.007 s | 0.879783× |

**The original 1.20× target did not pass.** In room 1 the identical capture-only neural workload finishes faster despite awaiting 41.797 seconds of acquisition. That indicates substantial order/cache/scheduling/clock-state variation; subtraction cannot establish capture overhead. Final neural work also changes with input (5.81% and 19.46% more steps). See the complete JSON reports and bound build identity here rather than treating wall time as a pure GPU benchmark.

Other agents’ native, GPU and build work was paused throughout the paired run. The harness conservatively hardcodes `performanceAcceptance:false` and `concurrentLoadUncontrolled:true`; these flags are not a runtime observation of another workload. The run used hardware Chrome 153 on Apple M5 Pro, macOS 26.4.1 (25E253), AC power, battery charged. The build identity binds baseline 88813fe5 and retinal build from 981368b4. Later setup/suspension/workbench fixes do not change normal optical or neural inputs, but this measurement is not represented as a measurement of those later sources. Final UI/resource tests use the reviewed production bundle.

## Observed gameplay outcomes

The same seeded sixteen-fly runs changed actual game outcomes, not only neural summaries. At the diagnostic ten-minute horizon, room 0 escaped 3 flies with old vision and 2 with retinal vision (one star in both); room 1 escaped 10 versus 7 (three versus two stars). Room 0 caught 2 versus 1 and timed out 11 versus 13; room 1 zapped 1 in both and timed out 5 versus 8. No starvation occurred. The capture-only control reproduces old outcomes exactly.

These two paired cases establish changed outcomes, **not better navigation**: fewer flies escaped with retinal input in both. They do not estimate overall difficulty or success across seeds. The second room’s authored timer is shorter than this diagnostic horizon, so these are not represented as scores from two ordinary-duration player attempts. No gains or body controls are tuned to these outcomes.

## Why the release budget changed

The planning target first appeared in 3943838b with 32×32 rasters, 61 samples and 128 MiB history. The accepted 9d75a41c profile increased raster pixels 16-fold, samples 11.82-fold and archive capacity four-fold, while leaving the relative-time target unreconciled. The user explicitly said: “you can make the budget whatever you want, I did not give you a budget requirement”. Their quality choice remains fixed.

The release budget therefore measures the playable requirement: compute at least as fast as simulated time, preserve the complete archive, keep replay free of underruns and maintain responsive frames and cancellation. The observed final worker-only runs compute 600 simulated seconds in about 150 seconds; this is evidence of headroom, not a substitute for the final full UI checks. We retain the failed relative target as a disclosed cost instead of lowering eye quality or claiming it passed. The neural significance criteria are unrelated and remain unchanged.
