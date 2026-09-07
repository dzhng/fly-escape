# Stored edges and physical features

**Verdict: historical SAT probes retain sampled agreement, but their raw-edge
inventory is not an accepted correctness oracle.** Parry stores deleted internal
triangulation diagonals after merging faces. Active boundary IDs come from the
deduplicated `edges_adj_to_face()` array. The full hull has 5,490 stored edges and
5,245 active edges; the derivative has 729 stored and 378 active edges. Counts
come from the [topology rejection](../native-envelope/path-comparison/README.md),
which separately establishes invalid reconstructed derivative face geometry.

## Consequences by use

The scratch `sat.rs`, `domain.rs`, `identify.rs`, and `coverage.rs` evaluate stored
edges using adjacent-face cones and endpoint-derived plane offsets. A deleted
diagonal does not carry the required physical-feature semantics. An incorrect
witness offset can cut into the configuration obstacle. Their numerical agreement
at sampled poses remains recorded evidence; claims of exact or complete oracle
correctness require a validated feature inventory and supporting planes.
Projected offsets ensure containment for each plane, but do not prove that an
invalid topology supplies every required direction.

`feature_prune.rs` instead measures distances to stored edge segments. Additional
diagonals conservatively add pairs and distance calls; they do not remove active
edges. On the checked full hull, the excursion-bound exclusion argument survives.
Historical counts and timings measure that implementation, not necessary active
feature work. The long-translation result demonstrates its cost, not a lower
bound on every complete method. Its face-fan coverage argument cannot transfer
to the derivative's invalid face topology without separate validation.

Vertex-neighbor probes (`feature`, `climb`, `events`, and `walk`) and the edge
scalar-event probes compare genuine point differences. Extra point inequalities
are redundant for a valid full-hull support feature; extra graph links can change traversal work.
They do not inherit the adjacent-face cone defect merely by reading stored edges.
A derivative graph with missing physical adjacency still cannot certify a
complete local cone or transition inventory. Existing numerical tolerances and
sampled validation remain limits of those experiments.

The outer-construction probes use stored edge counts as metadata; this discovery
does not invalidate their measured point-support queries, containment, or browser
captures. Axis counts using stored edges are loose upper bounds, not physical
feature counts. Invalid face topology is a separate limitation.

## Independent check of the retained edge and tie

[Check source](edge-check.rs) reconstructs the original full hull in millimetres
with the existing pinned `parry3d-f64 0.30.2` release library. It checks the exact
pair used by `edge.rs`, `edge_events.rs`, and `edge_events_incidence.rs`, without
changing those probes. [Results](edge-check.json) record the source asset hash.

Edge `[1084,1312]` is stored ID 3717 and belongs to the active inventory. Both
adjacent faces, 2147 and 2148, include that edge in their incidence arrays. Each
face has zero measured positive halfspace violation across all hull points;
maximum endpoint-plane residual is 2.22e-16 mm. Their oriented cone triple product
is 0.5505907338645899, so the cone is not degenerate in this fixture.

This resolves the specific deleted-edge concern for the retained edge evaluator
and its tie experiment. Their local geometric interpretation and recorded sampled
agreement stand. It does not validate global discovery, absence of competitors,
continuous motion, or a general incidence policy. The scalar endpoint anchoring
still needs the incoming event's identity and root/time bracket, as already
required by the [edge-feature analysis](../edge-feature.md).
