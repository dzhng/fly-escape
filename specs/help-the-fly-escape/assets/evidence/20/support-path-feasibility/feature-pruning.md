# Finite-interval feature pruning

**Verdict: conservative candidate pruning is useful for short intervals; long
translation remains broad in this stored-edge prototype.**
[Numeric summary](feature-prune-summary.json) records counts, distance calls and
native timings. Source and full pair lists remain in
`/tmp/fly-rotation-probe/src/bin/feature_prune.rs` and
`/tmp/fly-rotation-probe/feature-prune-results.json`.

The prior whole-hull excursion bound `B` also bounds every point of every native
vertex, edge and face. A feature farther than `B` from a stationary triangle at
the interval midpoint cannot contact it during that interval. Face interiors
inherit the same bound by convexity. The implementation uses feature AABB
separation first, then actual distances for every surviving contact-type pair:

- Native vertex to triangle face: point-to-triangle distance.
- Native edge to triangle edge: segment-to-segment distance.
- Native face to triangle vertex: minimum point distance over an exact fan of
  that convex face polygon.

No preferred winner, local topology ring or sampled collision acceptance is
used. All native vertices/edges/faces are considered for each retained triangle.
The existing numerical exclusion margin is retained; it does not move geometry.
The argument is geometric; numerical query accuracy remains subject to the
established kernel precision, not a formal floating-point proof.

| Interval | Vertex/face | Edge/edge | Face/vertex |
| --- | ---: | ---: | ---: |
| Short turn | 48 | 0 | 0 |
| Short tilt | 21 | 0 | 0 |
| Short rotation plus translation | 59 | 0 | 0 |
| Cone boundary | 98 | 302 | 0 |
| Edge boundary | 116 | 422 | 66 |
| Tilt competitor | 111 | 66 | 0 |
| 6 mm translation | 12,704 | 83,644 | 24,744 |

The known edge pair (hull `[1084,1312]`, triangle 201 edge `[122,82]`) is asserted
present in the edge-boundary candidate set. Triangle 200 / hull vertex 46 is
asserted present in the tilt-competitor set. These checks guard known omissions;
they do not supply the completeness argument, which comes from the excursion
bound and exhaustive feature categories.

Short intervals take roughly 0.70–0.72 ms including triangle and feature filtering;
the edge-boundary case takes roughly 1.65 ms. The 6 mm translation takes roughly
7.66 ms and retains 121,092 pairs. These are individual native release observations,
excluding event construction, root solving, browser overhead and initial asset
preparation. The summary preserves exact measured times from the final run.

The long-translation result is a concrete limitation: a single excursion radius
becomes loose as root travel grows. This candidate set is bounded by native
feature counts and retained triangles, but is not yet a tractable complete event
workload for arbitrary intervals. Shortening intervals preserves correctness but
adds renewal work; its total cost must be measured rather than inferred from
one short case. Normal-cone exclusion may reduce additional candidates, but is
not implemented or credited here.

The pruner certifies exclusions for the specified proposed path. It neither
validates the retained support feature nor prevents an included competitor from
being hit. Event resolution, valid acquisition, unchanged geometry and actual
forward progress remain the path owner's responsibility.

The [edge inventory audit](edge-inventory-audit/README.md) identifies extra stored
diagonals in the edge/edge enumeration. They increase retained pairs and work;
the full-hull excursion exclusion remains conservative. Counts above are not
active-boundary counts or a minimum required event workload. Derivative face
topology needs independent validation before reusing the face-fan argument.
