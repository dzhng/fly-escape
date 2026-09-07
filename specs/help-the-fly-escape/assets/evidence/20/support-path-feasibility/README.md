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
triangle-edge × hull-edge axes. The historical code iterates stored edges,
including deleted diagonals; its normal-cone/witness assumptions therefore do
not establish correct halfspaces. The [edge inventory audit](edge-inventory-audit/README.md)
qualifies these measurements and separates valid excursion math from topology assumptions.
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

## Body integration regression

The isolated body prototype in `/tmp/fly-supported-motion` passes native apple
landing followed by proboscis-driven feeding, but its walking-to-edge case is
red: [inputs and reached state](body-edge-failure.json). Synthetic motor readouts
isolate physical movement here; this is not the twenty-real-brain gate. The fly
reaches the fruit edge, loses projected support, and immediately hits the same
surface at zero elapsed time. A direct no-progress check now reports the failure
instead of repeating it until the work budget is exhausted. Native release
reproduces the failure in0.69s.

The prototype is uncommitted and excluded from the root recording checkpoint.
It also lacks continuous rotational collision proof, neighboring-food validation
on supported segments, and an accepted replay trajectory. Retain its behavior
regressions while replacing endpoint projection with the accepted path owner;
its passing landing test alone is not permission to ship the movement.

## Retained rotating feature: cheap evaluation, incomplete domain owner

A triangle-face / hull-vertex contact admits a direct root-height formula. With
triangle normal `n`, a triangle point `a`, rotated native vertex `q*v`, and chosen
root `x,z`, height is `(n·(a-q*v)-n.x*x-n.z*z)/n.y`. Its local domain requires the
contact point to stay inside the triangle and the vertex to remain the hull's
minimum projection along `n`. Triangle barycentrics and adjacent-vertex projection
comparisons test those conditions without scanning all hull vertices.

The retained feature at the upright traverse's starting point is apple triangle
201 / reconstructed hull vertex 1423, which has four neighbors. Short turn,
tilt and combined paths retain that feature and match 1,001 reference support
queries per path within 2.08e-15 m. Wider paths leave the vertex cone; keeping the
stale vertex then produces errors up to 0.868 mm. The cone test identifies those
sampled failures. [Retained-feature results](feature-results.json.gz) include
validity outcomes and timings. These are sampled domain checks, not a continuous
interval certificate.

The [adjacency experiment](climb-results.json.gz) instead follows the minimum
projection through the native hull graph. Each fixed-orientation search strictly
decreases `(projection, vertex ID)`, giving a finite bound of the hull's vertex
count. The tested 1,001-sample paths visit at most two or three vertices per
sample and compare at most 46 neighboring projections. Equal-height boundaries
between selected vertices agree to 4.27e-17 m after bisection. Some coarse sample
intervals contain multiple neighbor changes; their endpoint bisection does not
prove the intermediate feature order. The pure-turn path's 25 sampled handoffs
are all adjacent.

| Native evaluation scope | 20 evaluations | 100 evaluations |
| --- | ---: | ---: |
| Retained vertex, local cone and barycentric checks | about 0.70 μs | about 3.52 μs |
| Adjacency updates, height and barycentric computation | about 2.5 μs | about 12.8 μs |

These averages cover 10,000 native release batches. The adjacency timing includes
path wraparound and averages about 1.08 visited vertices per evaluation. They
exclude preparation, global competing-feature checks, reference queries and
WASM overhead. The adjacency timing computes barycentric coordinates; it is not
a complete global validity check. Fast local arithmetic does not establish the
20/100-fly replay gate.

Two actual boundary cases identify the next missing ownership:

- At heading 0.7155 rad, the turn reaches triangle 201's edge `[122,82]`, with
  hull edge `[1084,1312]`. The sampled SAT probe identifies this
  [edge/edge contact](transition-turn.json.gz); retaining only a triangle face
  cannot describe it.
- At up-vector x component 0.4823, triangle 200 / hull vertex 46 overtakes the
  retained triangle 201 / vertex 119. The previous contact still lies inside
  triangle 201, so its local domain passes while another part of the hull touches
  the neighboring face first. The resulting error is 2.26e-7 m, exceeding the
  established numerical tolerance. The [competing-face result](transition-tilt.json.gz)
  proves local triangle validity alone is insufficient.

Apple indices refer to the baked contact mesh. Hull indices refer to Parry's
reconstructed convex-hull point ordering, not the JSON input vertex order.
Scratch implementations are `feature.rs`, `climb.rs` and `identify.rs` under the
same temporary probe crate. No runtime feature schema or performance contract
is adopted by this evidence.

## Sampled local feature coverage through the failing paths

The [coverage probe](coverage-results.json.gz) evaluates all SAT feature types
for every apple triangle whose projected bounds intersect the native hull's
conservative footprint. The radius is derived from the hull, not a food/contact
radius. Candidate discovery uses geometry rather than a preferred winner or a
fixed ring around triangle 201. It finds 33 candidate triangles at this fixed
root XZ and automatically selects winners across triangles 200–203.

Each of the three wide turn/tilt paths is checked at 1,001 poses against both
`support_at` and a static native-hull/whole-apple contact query. The maximum height
disagreement is 4.66e-12 m; the deepest reported contact is -9.54e-17 m. No sampled
pose fails the established 1e-8 m tolerance. This crosses the previously failing
vertex, edge and neighboring-triangle cases without choosing their IDs manually.
It proves sampled pose progress; it does not certify the continuous intervals
between samples or physical acquisition/loss.

The candidate feature set includes triangle-face/hull-vertex,
hull-face/triangle-vertex and edge/edge planes. The reconstructed hull contains
1,832 vertices, 3,416 faces and 5,490 stored edges (5,245 active incidence
edges); reconstruction merges two of the
1,834 input points. Before normal-cone culling, the per-triangle axis bound is
`2 + hull faces + 6 * hull edges`. The largest retained set in these runs contains
127,566 planes. The search is bounded by mesh/hull sizes but does not yet have a
production work budget.

Mean native evaluation costs are 5.33–5.38 ms, excluding reference/static checks
and initial hull construction. That is a substantial improvement over rebuilding
Minkowski hulls, and still unsuitable as an accepted per-frame swarm evaluator.
No 20/100-fly browser timing is inferred from the cheap single-feature results.
New neighbors can be discovered with the same conservative footprint query as
root position changes; these runs keep root XZ fixed and do not validate moving
footprint updates, BVH integration or retained-set invalidation.

The source remains `/tmp/fly-rotation-probe/src/bin/coverage.rs`. Its sampled
comparisons remain useful, but the raw-edge implementation is not an accepted
correctness oracle. See the [inventory audit](edge-inventory-audit/README.md)
before using it to validate competing-feature reductions.

## Conservative exclusion over a finite rotating interval

The [interval experiment](interval-results.json.gz) reduces competing triangles
using a geometric whole-interval excursion bound. It does not infer safety from
sampled absence. Its specified candidate path uses linear root XZ translation,
shortest quaternion interpolation, and the retained triangle-face/hull-vertex
height formula above. The formula remains defined after feature-domain loss,
which lets the filter retain possible collisions even for an invalid proposed
path. It does not make that path valid.

Let `theta` be the total quaternion angle, `R` the largest native hull vertex
radius, `v` the retained vertex, `n` the unit triangle normal with positive `n.y`,
and `dx,dz` the interval's planar displacement. Relative to the midpoint:

```
vertical = (abs(n.x*dx + n.z*dz)/2 + 2*length(v)*sin(theta/4)) / n.y
rootBound = sqrt((dx*dx + dz*dz)/4 + vertical*vertical)
B = rootBound + 2*R*sin(theta/4)
```

Every transformed hull point lies within `B` of its midpoint counterpart: the
first term bounds root travel, and the second bounds rotational travel. Distance
to a fixed triangle is Lipschitz under that excursion. Consequently, midpoint
hull-to-triangle distance greater than `B` excludes contact throughout the
interval. The implementation keeps an additional existing 1e-8 m numerical
margin in this exclusion comparison; it does not offset the geometry or path.
This exact-arithmetic argument still depends on the numerical distance query's
accuracy. Sample checks exercise that implementation; they are not a formal
floating-point error proof.

A conservative midpoint root box expanded by `R + rootBound` first rejects distant
triangles. The remaining triangle distances require no active-winner IDs. On the
same authored apple, short turn/tilt/mixed intervals retain only triangle 201;
a cone-crossing interval retains four triangles and an edge-crossing interval
retains six. These short intervals perform 16 distance queries and cost about
222–317 μs natively, including scanning all 1,520 triangle bounds. A broad 1.67 rad
interval retains 23 triangles and costs about 399 μs. The broader interval honestly
loses pruning power rather than dropping candidates to meet a fixed count.

All six fixtures check actual transformed native vertices at 101 poses against
the derived excursion bound and independently search for triangle contacts at
those poses. They find no exceeded bounds or missed contacts. The retained
feature is not validated by these checks; boundary-crossing fixtures can represent
invalid proposed motion. Existing valid starting contact, feature-domain events,
and competitor resolution are still required before moving a body.

This provides an implementable candidate exclusion primitive: retain the certified
triangle set until the specified interval expires or the path changes. Rebuilding
on every rendered frame is not proposed. The cost and frequency of interval
renewal, feature events and changed paths need measurement before an event-driven
owner can be accepted. The scratch source is `src/bin/interval.rs` in the temporary
probe crate; no core API or production cache is introduced.

The [retained-feature domain event probe](domain-events.md) derives analytic
crossing events instead of relying on sampled feature transitions. The
[bounded face walk](face-walk.md) makes local progress through vertex changes to
triangle boundaries. Numerical ambiguity and global competitor gates remain
explicit.

The complementary [edge-to-edge feature probe](edge-feature.md) evaluates the actual narrow turn handoff and its segment/cone domain. Continuous transition ownership remains open.

The [feature-pair pruning probe](feature-pruning.md) applies the interval bound
to all native feature types. It reduces short intervals substantially but exposes
a large candidate set for 6 mm translation.

The [outward native envelope comparison](native-envelope/README.md) tests smaller
conservative representations before expanding event machinery. Its heading sweep
shows why the favorable original contact poses cannot select a hull alone.

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

The next bounded experiment is resolving feature-domain and competitor events
inside the certified interval set, then measuring interval renewal and path-change
frequency. Continuous accepted-path validity and browser work bounds remain
separate gates.
