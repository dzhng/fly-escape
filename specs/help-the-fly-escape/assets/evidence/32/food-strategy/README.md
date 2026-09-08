# Food placement as attraction and distraction

Three matched seeds,20flies each, five simulated minutes on the current first-house maze. Every arm keeps the same fixed household objects and short-range exit suction. No fans. The same apple, banana and dirty dishes are compared in the route and clustered arrangements; only their positions change. Empty and single-apple conditions provide context, not equal-count comparisons.

| Arrangement | Escapes by seed | Mean seconds/fly near added objects | Walking nearby (seconds/fly) |
| --- | --- | --- | --- |
| Empty | 1,1,2 | — | — |
| Apple near exit | 1,1,0 | 0.44 | 0.19 |
| Food/leftovers along route | 3,3,0 | 17.87 | 7.16 |
| Same objects in starting room | 0,0,0 | 102.86 | 39.08 |

The route arrangement improves on the clustered arrangement in two seeds and ties in one. It improves on empty in two and loses in one; this is early mechanic evidence, not accepted campaign balance. Holding flies near food can be strategically harmful. Adding food is not inherently harmful: location and the resulting competing odor fields matter.

Near means within0.9m of any added placement; walking time is the subset of those ticks whose body mode is Walking. Departure means a visitor later reached more than1.1m from every added placement, so small boundary jitter is excluded. All54 route visitors and57/58 clustered visitors departed at least once; long residence can include repeated visits and is not a permanent lock. Comparing near times across different object counts changes covered area; the same-count route/cluster comparison avoids that particular confound.

These runs mainly show proximity and walking, not eating or consistent landing on a food model. Only six fly-ticks of actual food-surface support were recorded in the clustered runs, and none in the other arms. Feeding/energy extension remain deferred. Do not claim that every lingering fly is physically on food.

Inputs and full native results are alongside this report. `probe.rs` is scratch instrumentation around the actual Graph/Attempt, with no movement or neural shortcuts. It records the trajectories' consequences rather than forcing the requested outcome. Its isolated worktree retains the earlier long-horizon validation cap, but these runs use the ordinary3000 ticks.

The browser reports are real placement/release/replay attempts. The exit-apple and route arrangements each escaped1/20 in the captured browser seed. Their camera-clicked positions differ slightly from nominal native coordinates, so they are not exact reproductions of the native runs. A first route browser attempt timed out during buffering under concurrent compute; the recorded route attempt is a completed retry. Performance remains a separate unresolved gate.

## Vinegar beside a competing household attractor

Keeping the route food unchanged, adding vinegar beside the fixed Study banana produced the same escape counts: 3,3,0. Mean Study residence per fly changed from16.30,13.11,28.11seconds to17.73,42.59,17.14seconds across the paired seeds. This is not consistent avoidance or a demonstrated useful counter. One caught fly in the baseline became none with vinegar, but that single event cannot establish hazard protection.

The actual browser counter attempt also finished with1/20 escaped, matching its route-only comparison. The extra object was accepted through the placement UI; the three route positions and seed matched. Native coordinates and browser coordinates remain separate comparisons.

Use room occupancy for this comparison. The counter probe targets the Study banana, whereas the original route probe targets the exit; their target-distance metrics are not comparable. Likewise, adding vinegar changes the set measured by near-added-object metrics. These results support prioritizing food placement and clock/layout balance, without assuming vinegar can already redirect flies away from household distractions.

## Ten-minute continuation diagnostic

The same three seeds and nominal route-food input were run continuously to6000ticks with an empty control. Empty escaped7,4,5; route food escaped7,3,1. A longer horizon alone therefore did not establish a placement benefit. The complete report is `route-food-10min-results.json.gz`; its identity records the pre-anatomical-correction manifest. This is evidence about the old model, not chemical-specific biological validation or accepted level balance.
