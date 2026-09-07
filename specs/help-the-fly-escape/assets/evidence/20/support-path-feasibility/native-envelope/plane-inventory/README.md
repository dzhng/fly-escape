# Original-plane boundary inventory

**Verdict: retaining the original supporting planes avoids the measured invalid
QuickHull feature inventory and provides a promising fixed-path representation.**
This is a scratch prototype. Numerical incidence and dense reference checks
pass. An independent integer-arithmetic check below certifies the boundary
connections for the stored binary64 planes; continuous rotating movement is
not yet accepted.

## Boundary construction

The existing preparation regenerates the same 128 outward supporting planes from
the full native animation hull. Each offset is the maximum source-point projection
onto its unit normal. Six initial axis planes retain the exact source extrema.
No points are perturbed, planes moved, retries added or dependencies introduced.

For every pair of nonparallel planes, the probe constructs their intersection
line and clips it against every other halfspace. The defining planes are skipped
by incidence identity. A nonempty bounded interval contributes an edge. Its two
endpoints carry the third limiting plane identity; sorted plane triplets identify
vertices without proximity merging. Incident axis coordinates are taken directly
from their source planes. Edge direction comes from the cross product of its two
normals, avoiding subtraction of nearly coincident endpoints.

In exact arithmetic every polyhedron edge lies on such a pairwise line, so this
exhaustive construction supplies the boundary inventory. Floating-point results
must separately pass endpoint feasibility, incidence and closed-face checks.
[Halfspaces and edge results](halfspaces.json.gz) retain the original normals,
offsets, endpoint coordinates and limiting plane IDs. Distances are millimetres;
normal components are dimensionless. Regeneration produced identical edge data.

## Geometry validation

[Validation](validation.json.gz) reports:

- 128 faces, 378 edges and 252 plane-triplet vertices; Euler characteristic 2.
  Each vertex has three incident edges. Every face forms one connected cycle
  with degree two at each of its vertices.
- Maximum reconstructed vertex halfspace residual: 1.78e-15 mm; maximum incident
  plane residual: 4.44e-15 mm. Raw line endpoints before exact axis assignment
  have maximum halfspace residual 5.11e-15 mm.
- All six extrema exactly equal the durable candidate, including its floor.
- Maximum candidate vertex nearest reconstructed-vertex distance: 1.43e-13 mm.
  Maximum reconstructed-vertex distance to the candidate support-map hull:
  1.35e-14 mm. Across 4,096 directions, maximum support difference is 2.67e-15 mm.

The plane-intersection pass takes about 4 ms in one native release run, excluding
regeneration of the supporting planes. It tests all 8,128 plane pairs with at
most 126 remaining halfspace constraints per pair. This is offline preparation
cost, not per-frame work.

## Fixed paths and matched wide cases

The [four fixed-orientation paths](fixed-paths.json.gz) retain the previous 6 mm
XZ translation, apple, normalization and core references. SAT face/edge offsets
use their incident vertices from this inventory; global point scans are no longer
needed to repair invalid witness offsets. Each path retains 50 apple triangles.

| Orientation | Path construction | Total setup and path | Selected spans | Maximum full-hull root difference |
| --- | ---: | ---: | ---: | ---: |
| Upright | 1.43 ms | 5.54 ms | 9 | 9.77 μm |
| Turned | 1.16 ms | 3.03 ms | 4 | 8.31 μm |
| Tilted | 0.99 ms | 2.87 ms | 5 | 2.84 μm |
| Turned and tilted | 0.93 ms | 2.75 ms | 4 | 4.18 μm |

All four have zero missing samples and zero uncovered intervals. Each is checked
at 2,001 fractions against both durable-candidate and full-hull core queries.
Maximum candidate-query discrepancy is 1.66e-13 m. Selected spans coalesce winning
span identities rather than all collinear geometry. Total includes loading the
prepared inventory and native query setup, excluding offline pair clipping and
dense reference checks. These are single-run native timings, not a WASM budget.

The already matched [wide coverage cases](wide-coverage.json.gz) also pass their
1,001 sampled fractions each: turn, tilt and combined motion have mean full-local
inventory evaluation costs 0.374–0.384 ms, maximum candidate core discrepancy
2.36e-12 m and deepest static contact -9.54e-17 m. They enumerate the local
inventory at every sample; they do not construct continuous rotating segments.

## Numerical limits and next gate

Twelve retained edges have lengths from 6.9e-15 to 1.67e-11 mm. Nine rejected
plane-pair intervals have negative lengths within 4e-12 mm of zero. The smallest
nonzero clipping slope is 1.10e-16. Those diagnostic ranges do not change geometry
or suppress constraints: near-zero positive intervals remain present, negative
ones remain rejected. Their exact combinatorial classification is not certified
by ordinary floating-point signs. Cycle/count agreement is useful corroboration,
not a replacement for an exact-sign check. The subsequent independent check
below resolves these signs for the stored planes.

## Independent exact-sign check

[Exact results](exact-signs.json.gz) enumerate all plane pairs again using integer
arithmetic. Each stored binary64 coefficient is converted to its exact integer
ratio. The largest denominator in a plane is a common power of two, so scaling
its normal and offset together yields an equivalent integer inequality without
rounding. The six axis planes bound a full-dimensional intersection.

For integer plane normals `n,m`, offsets `a,b`, let `d=n×m`, `L=d·d`, and
`p=a(m×d)+b(d×n)`. The pair line is `x=(p+t*d)/L`. Every other integer plane
`k·x≤c` becomes `(k·d)t≤cL−k·p`. Lower/upper rational bounds are compared by
integer cross multiplication; no division or float tolerance decides validity.
Parallel pairs cannot define an edge line. Every resulting endpoint is checked
against every halfspace with exact integers. Coordinates are rounded only for
reporting.

The result has the same 252 vertices and 378 positive edges, with no point-only
pairs. Every edge's incident plane pair matches the floating inventory. Maximum
reported endpoint difference is 1.70349e-13 mm. All vertices have exactly three
independent incident planes; their sorted identity triplets uniquely identify
them. Runtime is about 1.39 seconds in the scratch Python standard-library
oracle; no dependency or production path was added.

A separate agent audited the formulas and inequality directions, independently
checked a strictly interior rational centroid, reconstructed every vertex by
rational Cramer's rule, and verified exact incidence and feasibility. This
certifies topology of these **stored binary64 halfspaces**, not exact containment
of the original sampled fly, recovery of pre-rounding construction planes, or
continuous rotating contact. The source artifact hash is retained in the result.

The next durable seam can retain original planes and incidence under the existing
offline asset owner. It must preserve the geometric rounding limits and validate
its own serialization. No runtime schema, body behavior or candidate asset was
changed here. Rotating domain events, global competitors, moving contact and
20/100-fly WASM performance remain separate gates.

Scratch source is `/tmp/fly-rotation-probe/src/bin/halfspace_edges.rs`, with
`plane_topology_probe.rs`, `check_plane_topology.rs`, and the `*_planes_witness`
variants of the existing envelope/coverage probes. The research code remains
outside the repository.
