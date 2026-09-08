# Separate doorway fan and vinegar effects

Four new native attempts on seeds110/111, same2× movement as the preceding doorway trial. [Frozen plans](plans.json), compact raw results under runs/, same [harness](../second-house-route/second_house_pilot.rs). No new controller, geometry, neural or field change.

| Setup | Escaped by seed |
| --- | --- |
| Empty (prior control) | 4,3 |
| Corner fan only (new) | 1,5 |
| Rear vinegars only (new) | 3,3 |
| Combined (prior trial) | 4,6 |

All four new attempts completed3000ticks. The combination exceeds its fan alone by3,1 and its vinegars alone by1,3. Relative to empty it gains0,3. That is a useful candidate interaction in this sample, not robust calibration. Fresh seeds are required because these two seeds informed placement design. The four reused counts are prior evidence, not new replication.

Root validated full inputs and terminal outcomes. The first launch failed because the scratch binary had been removed; rebuilding the unchanged harness resolved the missing executable, and no simulation occurred in those failed launches. Do not attribute the result to vinegar alone: it did not beat empty here. No difficulty percentile follows from two seeds.
