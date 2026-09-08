# Fan-free object comparison on the maze

Three matched seeds,20flies each, five simulated minutes. The level, fixed household objects, tuning, initial swarm policy and exit suction are identical. No ambient, fixed or placed fans. The only added placement is an apple, a vinegar bottle or nothing, at the same bedroom doorway location. The empty arm measures distance from the same virtual point.

| Condition | Escapes by seed | Mean distance (m) | Mean seconds within0.9m | First-minute arrivals /60 |
| --- | --- | --- | --- | --- |
| Empty | 1,1,2 | 3.517 | 6.775 | 18 |
| Apple | 0,0,1 | 2.944 | 12.250 | 26 |
| Vinegar | 1,1,0 | 3.496 | 7.292 | 20 |

Apple changes spatial behavior in these runs: more early arrivals, closer average distance and longer residence. At this location it reduces escapes. This is a whole-object result including its landable surface and taste/contact effects; it does not isolate odor steering. Vinegar does not show an avoidance benefit against empty. Three seeds are a diagnostic, not population-level balance acceptance or a guarantee of biological behavior.

`*-results.json` are continuous native Graph/Attempt runs; `empty.json`, `apple.json`, `vinegar.json` freeze inputs. `probe.rs` records the proximity measurements without changing simulation. Its scratch worktree permits a36000-tick maximum for earlier diagnostics, but these attempts use the normal3000 ticks. The same short-range suction is authored in each input.

The two `*-browser.json` files are completed actual browser placement/release/observe attempts. Both use the same seed and camera-projected placement point, but the clicked point differs slightly from the nominal native point, so they are not exact native replay reproductions. Browser apple escaped0/20; vinegar3/20. This variance is why one escape count is insufficient proof of repulsion. Both browser attempts use WASM build `a51969faa9b155f47c98e8787abe85b4a54e440a470a46212d6e51af3728a271` with suction enabled in the current campaign.
