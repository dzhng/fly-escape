# Blocked translation must not forbid a safe turn

A native first-house reproduction identified a contact fixed point beside a placed bottle. The body stops at tick 117 at (6.487809744, 0.050059439, 6.351019719), heading 3.661637, mode Landing, with no supporting surface. The recorded campaign has 2,882 stationary ticks. Instrumented ticks through 400 confirm that movement requests continue while the retained pose remains unchanged.

The contact solver successfully returns a stationary trace; it is not exhausting its query budget. A combined translating/rotating sweep is blocked. The existing code consequently rejects rotation without testing its independent in-place clearance. Instrumentation shows that the same requested turn is swept-clear at the retained root. The subsequent translation cast hits immediately, preserving the old heading and repeating the blockage.

This can inflate time-near-object statistics through collision handling, not neural attraction or distraction. Existing sensory experiments without solid objects remain separate evidence; this finding does not establish a defect in every food residence measurement.

The repair contract is to preserve a brain-requested in-place turn when that exact movement is physically clear, record its real timing, and keep translation blocked. Every accepted orientation must remain clear of both native objects and the floor. No turn toward an object, doorway or exit is invented. Query/knot bounds and replay remain unchanged.

The banked diagnostic is scratch instrumentation against the pre-fix state. It reproduces the same graph/content as the prior geosmin house control; the scalar odor pathway is disabled for that control. The combined/in-place clearance comparison is in `fly0-site13.txt.gz`. The production fallback now accepts an independently clear turn while holding the root. The entire quaternion arc must clear the implicit floor, not just its endpoints. Reachable terminal hazards retain their collision handling; ordinary contact may be deferred by a turn-only substep. Wall-blocked velocity components are removed when that substep advances time.


The fixed reproduction passes the former sticking point, lands on the floor at tick 119, and is flying near (6.41, 2.71) by tick 400. `fixed-fly0-400.txt.gz` records that run. The repeated-contact regression fails against the original motion code and passes against the fix. Dense interpolated-pose checks cover native surfaces and the floor, with separate exhaustion rollback and turning-into-zapper regressions. The full simulation suite and client tests pass.

Independent review found an intermediate floor intersection, potential repeated wall-shortened steps, missing exhaustion coverage, and a suppressed reachable zapper contact. The final implementation addresses these; the final review found no actionable regressions. The wall-step correction is conservative bookkeeping, without a dedicated reproducer. This evidence establishes the contact repair, not balanced levels or a general explanation of food retention.

The final WASM browser run used build `e997418762784b523af6b2fe77edf3a3b3950cd2108fb8891240be60f05c455d`, the same root seed and one banana at the first doorway. It completed all 3,000 ticks with one escape and 0 buffer underruns. Startup and frame timing were captured under concurrent native testing and are not release-performance acceptance. The screenshot shows the completed campaign result.
