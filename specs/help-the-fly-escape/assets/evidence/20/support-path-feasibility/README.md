# Supported path feasibility

**Verdict: research evidence for reslicing; no moving-contact acceptance.** A
compact exact supported path exists at fixed orientation. Rotating motion,
feature transitions, production cost and replay integration remain unproven.
No production behavior changes in this evidence pass.

## Tested geometry and query setup

The probes use the native fly envelope from commit `96bf3f6`: 1,834 vertices,
with source GLB SHA-256
`775e7ce610229c9aec74d0b6c004a810c6bb13c5519d7288ccd97c32042c4246`.
The authored apple has 1,520 triangles. Both are converted from metres to
millimetres for Parry 0.30.2 f64 queries. The envelope samples animation finitely;
these probes do not establish continuous animated-vertex containment.

Runnable experimental sources remain in `/tmp/fly-rotation-probe` rather than
becoming production helpers. The numerical outputs are preserved here. Native
release timings are individual local observations, not a controlled benchmark,
a worst-case bound, or browser/swarm evidence. They exclude asset loading and
native hull preparation. No WASM runtime measurement was performed.

## Rotating nonlinear casts: rejected as a direct replacement

[Raw results](results.jsonl.gz) cover nine paths. Each uses linear root translation
over normalized time `[0,1]` and shortest quaternion interpolation. The latter is
expressed as angular velocity from the axis-angle of `q_to * inverse(q_from)`,
with the local rotation center at the native asset pivot. Endpoint quaternion
agreement is at floating-point precision.

- Upright and turning downward acquisition return plausible fractions but
  `Failed` status. A plausible fraction does not make that a converged query.
- A tangent turn and sufficiently large upward departure return no hit,
  consistent with the sampled separation checks.
- Small upward departure while tilting upright, pure tilt and inward travel
  penetrate before the impact reported with `stop_at_penetration=false`.
  This mode prevents directional tunneling; it is not strict first-contact CCD.
- `stop_at_penetration=true` can instead halt at initial support during harmless
  rotation. Neither boolean alone meets the required movement contract.

The public API has no caller iteration budget. Its internal searches terminate
by tolerances and time advancement. All tested calls completed, which does not
prove a worst-case work bound. Distance and contact checks at 101 poses
corroborate penetration; finite sampling does not prove continuous absence.

## Exact fixed-orientation path

For a root translation, each triangle creates a configuration-space obstacle:
the triangle plus the negated, rotated native hull. The upper boundary of the
union determines supported root height. Along a requested planar line this
boundary is piecewise linear. Its finite facet domains expose support boundaries
without adding clearance or querying physics during each rendered frame.

The traverse holds `x=20 mm` and moves `z=-3 mm` to `+3 mm`. All three tested
orientations are fixed throughout their own traverse; comparing them does not
establish the transition between orientations.

| Construction | Heading; up vector | Local triangles | Construction time | Maximum error against 101 support queries |
| --- | --- | ---: | ---: | ---: |
| Explicit 3D Minkowski hulls | 0; `(0,1,0)` | 50 | 498.45 ms | 4.80e-12 m |
| SAT planes, pairwise facet domains | 0; `(0,1,0)` | 50 | 612.85 ms | 7.74e-14 m |
| SAT planes, 2D domain clipping | 0; `(0,1,0)` | 50 | 32.98 ms | 7.74e-14 m |
| SAT planes, 2D domain clipping | 0.15; `(0.4,sqrt(0.84),0)` | 50 | 21.31 ms | 2.65e-14 m |
| SAT planes, 2D domain clipping | 1.3; `(0.7,sqrt(0.51),0)` | 50 | 13.36 ms | 7.67e-16 m |

SAT candidates comprise the triangle normal, native hull facet normals and
triangle-edge × hull-edge axes. Edge normal cones discard irrelevant candidates.
The scratch slice uses a ±1,000 mm vertical bracket enclosing this fixture;
that bracket is not proposed as a world-wide support limit.
Clipping their halfspaces in `(path fraction, root height)` directly avoids
constructing 3D Minkowski hulls. The resulting polygons define upper facet
intervals; their upper envelope supplies path breakpoints. The upright raw
arrangement contains roughly a thousand cuts, mostly on inactive facets. About
ten meaningful path vertices remain after removing numerical collinearity;
that exploratory count is not a production compression or archive guarantee.

Outputs preserve [explicit hulls](envelope-results.json.gz),
[pairwise SAT domains](sat-results.json.gz), and 2D clipping for
[upright](domain-results.json.gz), [tilted](domain-tilted.json.gz), and
[steeper](domain-steep.json.gz) poses. Timings include candidate selection,
construction and raw envelope assembly, and exclude the 101 reference queries.
The height formulas introduce no clearance offset. Agreement with sampled
queries supports this implementation; it does not replace tests at every facet
boundary or prove robustness for arbitrary geometry.

## Cheaper event walk: still red

An attempted shortcut follows the current support plane and asks the existing
fixed-orientation cast for the next obstacle. It immediately returns a zero-time
hit on the same apple: [numeric result](active-event-failure.json). The existing
triangle-plane tangent rejection does not cover every native-hull edge/vertex
support feature. A normal without its feature domain cannot drive this walk
reliably. Repeating that event is not forward progress.

## Remaining gates

- Retain an active feature and its exact domain; cross its boundary without
  zero-time cycling, skipping intervening obstacles, or jumping across gaps.
  Compare emitted segments with the brute-force envelope oracle.
- Establish continuous orientation changes. Fixed-orientation paths cannot be
  joined by snapping rotations. An analytic rotating feature evaluator still
  needs domain validity and transition checks.
- Bound candidate work, feature transitions, archive size and failure behavior.
  Measure preparation and replay in browser WASM for 20 and 100 flies. Current
  millisecond construction costs are not production performance acceptance.
- Verify landing, walking, feeding, support loss, departure, revisit and
  neighboring-food collisions through the actual body owner. Prove every replay
  segment uses the accepted path, including pause and reverse seeking.
- Preserve the native geometry and established numerical tolerance. Neither
  clearance padding nor a more permissive penetration threshold is adopted here.

The next bounded experiment is active-domain traversal or reuse of these SAT
planes, measured against the retained exact oracle. A cheaper single-plane
height formula is promising only if its domain and transition costs also pass.
