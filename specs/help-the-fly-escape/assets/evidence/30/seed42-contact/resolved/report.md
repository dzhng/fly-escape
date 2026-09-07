# Conservative native angular collision response

The original seed 42 late landing panic was preceded by invalid free motion.
At tick 201 an in-place orientation change produced 6.789 µm of shoe penetration.
A second captured candidate at tick 200 retained its quaternion but accepted a
translational impact 21.881 µm inside another component. Both are reduced tests.

The nonlinear query now supplies a clearance decision. A contact or typed Failed
solve declines the angular component, retaining the exact starting quaternion
and heading while the existing translation cast still tests motion. Clear turns
require swept proofs both at the starting root and along the translating root.
Malformed poses, unsupported queries and iteration-budget failures remain errors.
MotionTrace exposes rotation_blocked and rotation_unresolved diagnostics.

The translational cast uses the retained quaternion directly, without reconstructing
roll from heading/up. Penetrative candidate roots retain the preceding verified
pose and consume the remaining tick; an invalid retained pose remains an error.
The existing 3 µm motion and 10 nm contact precisions and 512 query budget are unchanged.
Zero-time support acquisition updates the retained trace endpoint before the next
supported request; a missing support identity returns an error instead of panicking.

Tradeoff: angular requests near geometry can be refused even when a more capable
solver could have found a clear turn. This is physical collision response, not a
change to neural motor outputs. No custom angular refinement or solver flag search
ships. Diagnostic circle zappers and exact native hazard timing regressions pass.

Captured 20-fly seed 42 completes at tick 311: 2 escaped, 18 starved, 1 star. During that run,
temporary instrumentation checked every produced motion knot against the complete
native surface scene and aborted above 3 µm; it found no violation. Instrumentation
was removed before commit. This is native reproduction, not browser acceptance.

57 applicable lib/body/food/placement tests pass; workspace all-target check passes.
