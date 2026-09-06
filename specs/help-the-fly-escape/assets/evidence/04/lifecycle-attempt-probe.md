# Shared-attempt lifecycle demonstration

The lifecycle lab runs the production Attempt, Brain, fields and Body without synthetic neural readouts or hidden neural warmup. Food supplies gain-1 taste input through the shared motor-excluding current path. Each comparison has the same root seed and resolved content; the ablated arm clamps the annotated proboscis neurons for the entire attempt. Wind transports bodies away from food. Exit fixtures use stronger wind to demonstrate physical crossing and wall blocking, not neural escape navigation.

A bounded probe tested roots 0–9. Seed 6 was selected for the visible diagnostic: landing at tick 44, feeding initiation at 50, contact loss at 62, and starvation at 165. Its accumulated positive reserve changes total 3 units; the paired ablated fly has no increase and starves at 110. Seed 4 initiates feeding but loses contact in the same tick and gains nothing. Every result scores zero.

| Root seed | Meal starts | Positive reserve change | Meal arm starvation tick | Ablated starvation tick |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 108 | 108 |
| 1 | 0 | 0 | 109 | 109 |
| 2 | 0 | 0 | 104 | 104 |
| 3 | 0 | 0 | 111 | 111 |
| 4 | 1 | 0 | 106 | 106 |
| 5 | 0 | 0 | 108 | 108 |
| 6 | 1 | 3 | 165 | 110 |
| 7 | 0 | 0 | 109 | 109 |
| 8 | 0 | 0 | 108 | 108 |
| 9 | 0 | 0 | 106 | 106 |

All ten ablated runs have zero proboscis voltage/spikes, zero feeding starts and zero reserve gains. This establishes a reproducible lifecycle demonstration, not feeding efficacy across seeds or a taste-induced survival benefit. The selected demo seed is exported by the fixture owner; the supplied seed remains unchanged in AttemptSpec.

Choices with remaining uncertainty: the selected seed is deliberately favorable; the food radius and drift speed determine the contact window; compressed reserve costs/capacity and the review horizon are diagnostic time-scale choices; gain-1 taste has not established behavioral benefit; starting neural state is unwarmed and therefore includes startup dynamics. None of these change the approved body decoder. The original reserve-3 candidate died at tick 38 before landing and was rejected; reserve/contact duration was widened once, then the declared ten-seed probe was run without further search. All exact content values remain owned by lifecycle_lab.rs and exported in LifecycleInfo.level.

The native fixture test verifies open versus blocked escape, scoring and one terminal history entry. The actual-graph test is explicitly opted in with BRAIN_ARTIFACT_DIR because the binary is external test data. Ablation identity and range validation are tested through Attempt; disabling the clamp makes its regression fail on nonzero measured voltage. Source build identities below describe the isolated tested integration; root integration changes the build identity as designed.

```json
[
{"schemaVersion":1,"attemptId":"lifecycle-lab","graphHash":"6218f74521ca39652c59bd7524fb6aa5fe587058ce438a3fa08e4d8eee7cd454","graphManifestHash":"3a1f90af0a1e06733f6be2b8df82467f0312d221bf3a0096cf7c6de67db534e5","simulationBuildId":"77e4853e5bb1fc9d6db2b3d3031cb0029f1e4a19e0118d259a7a8e0e810a4e15","tuningHash":"1b8e8921965b02ff70c419613f6d0c87802f7b384161ef541a0e0172e416cd20","levelHash":"f819439144794f2c5ff72a565a893c97c8d21d24e261fb872cf650db37c02130","levelId":"lifecycle-meal","rootSeed":"6","flyCount":1,"durationTicks":300},
{"schemaVersion":1,"attemptId":"lifecycle-lab","graphHash":"6218f74521ca39652c59bd7524fb6aa5fe587058ce438a3fa08e4d8eee7cd454","graphManifestHash":"3a1f90af0a1e06733f6be2b8df82467f0312d221bf3a0096cf7c6de67db534e5","simulationBuildId":"77e4853e5bb1fc9d6db2b3d3031cb0029f1e4a19e0118d259a7a8e0e810a4e15","tuningHash":"fa946483dfbb3ceed9d05534e4bd2585ab88432360d58df76ef44c0041fc70e3","levelHash":"f819439144794f2c5ff72a565a893c97c8d21d24e261fb872cf650db37c02130","levelId":"lifecycle-meal","rootSeed":"6","flyCount":1,"durationTicks":300}
]
```
