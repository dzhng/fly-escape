# Trails in actual attempt playback — rejected visual checkpoint

Target: recent paths should be visible at Overview and close range while fly bodies remain readable. Added pixels alone do not establish this.

The production web build was served from an isolated worktree at `025c982` on port 5208. The harness enters `/`, clicks Run, and records 20 actual neural flies with no placements. It fixes only the setup seed source to 42, preserving the worker's graph, WASM, recorded modes and motion. Candidate and baseline use identical camera states, viewport 1440×900, DPR 1, model, room geometry, and cursor ticks 10.3, 30.5, 60.5 and 100.5. Close uses the existing minimum zoom distance; Overview uses the existing button. Reports preserve attempt provenance. Attempt IDs and production-progress text differ; renderer comparisons use the unchanged world bounds (0,205,1075,525).

The baseline is a disclosed counterfactual: a temporary single-line `false && scene.current?.setTrails(...)` in the isolated playback consumer, followed by a production build. It disables uploading trails only. The source was restored and the candidate rebuilt immediately after capture; no debug switch persists. All eight camera records are exactly equal across the pair, and specs match except their generated attempt ID.

Both builds passed exact canvas byte equality while paused and after a one-tick forward/reverse seek at every captured state. Both report zero browser errors. This tests actual production playback, not a substitute renderer fixture. No terminal/history unit checks were repeated. The actual paths become crowded/divergent at later captures; a deliberately contrived perpendicular-crossing fixture was not added.

## Visual findings

This reviewer did not implement trails and reviewed the first trail candidate independently. Prior context includes reviewing house/model visuals and implementing motion height. This is fresh-to-trails review, not a claim of no project context. Inspection covered all eight candidate full frames, corresponding paired world comparisons and all eight baseline/candidate tight crop pairs.

- **High confidence, full and crop:** white ribbons become readable at close scale, especially at ticks 60.5 and 100.5. However, tick 100.5 paints a conspicuous pale rectangle over the selected fly's dark abdomen (around screen 527,415), with another over the lower-right fly. These patches are absent without trails. Fly identity remains readable, but the non-obscuring requirement is not met.
- **High confidence, full and crop:** Overview paths are effectively indistinguishable at ordinary screenshot size. The entire swarm occupies a small area and the pale floor offers weak contrast. The magnified, unscaled crop pairs show only tiny changes. This does not support following each small fly's recent path.
- **Medium confidence, full and crop:** close tracks visibly fade into the pale floor, but old endpoints become difficult to follow. Still frames and the rendered state do not alone establish temporal fade quality.
- **High confidence, full:** controls and neural cards remain legible; no trail overlaps the UI. Existing fly-on-fly overlaps and extreme-close clipping also exist in the baseline and are not introduced by this change.

Verdict: **both are wrong for the target**. Baseline has no path cue; candidate improves close path visibility but fails Overview legibility and paints bright patches over bodies. Retain this rejected checkpoint for the next comparison. Root owns implementation corrections.

## Telemetry

`comparison/visual-parity-diff.json` includes full and world grayscale, edge and luminance metrics; its images locate changes rather than decide acceptance. `coverage.json` measures maximum RGB channel changes and includes a dark-pixel proxy (not an exact fly mask). `tight/close-pairs.png` and `tight/overview-pairs.png` show baseline left/candidate right, increasing cursor downwards.

| Cursor | Close world changed | Close pixels ΔRGB>16 | Overview world changed | Overview pixels ΔRGB>16 |
|---|---:|---:|---:|---:|
| 10.3 | 0.824% | 2,812 | 0.044% | 20 |
| 30.5 | 6.990% | 6,271 | 0.044% | 11 |
| 60.5 | 12.594% | 15,578 | 0.073% | 48 |
| 100.5 | 9.999% | 18,621 | 0.067% | 53 |

World contains 564,375 pixels. The selected 320×300 close crop changes over 16 RGB levels on 586 baseline-dark pixels at tick 100.5, consistent with the visible abdomen patch; the proxy does not attribute every changed dark pixel to a particular fly. The strongest world grayscale difference is close tick60.5: mean absolute delta0.91, edge energy ratio1.029, distance0.01414. These small whole-world averages do not negate a concentrated body artifact.
