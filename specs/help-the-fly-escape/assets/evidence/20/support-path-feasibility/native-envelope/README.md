# Outward native envelope comparison

**Verdict: smaller conservative representations are feasible; none is adopted by
this comparison.** The eight-heading check rejects judging fidelity from the
favorable original pose alone. The 128-plane candidate has the closest measured
agreement while still reducing query cost; browser comparison and physical
movement acceptance remain separate gates.

## Construction and meaning of the error

All candidates derive from the same baked native animation-envelope points and
GLB hash. They preserve metres, the authored apple, the query normalization and
the existing numerical tolerance. They introduce no query clearance, test ball,
inward shrink or altered animation. The source envelope remains a finite-sample
candidate, not a continuous animation containment guarantee.

Six initial supporting planes preserve the exact native axis extrema. Adaptive
refinement projects each outer vertex onto the full convex hull and adds the
native supporting plane at the worst deviation. Halfspace intersection is
constructed through polar duality around an interior centroid. Unmerged dual
triangle facets are transformed back into primal vertices. Incident axis planes
supply their exact source coordinate, preserving the floor height without
padding. The final point set uses the same native convex query shape constructor.

For nested compact convex bodies, maximum outer-vertex distance to the native
hull equals the maximum outward support-function error over directions. This is
a geometric measure, not solely a finite directional sample. The projection
queries are numerical; the reported precision and containment checks remain
explicit. Additional 4,096-direction support comparisons corroborate the
48/64/128 candidates without replacing the geometric argument.

## Reconstruction defect isolated and corrected

The first implementation converted the dual hull into `ConvexPolyhedron` before
inversion. Parry merges nearly coplanar dual facets there. Inverting those merged
facet planes lost primal detail: the nominal 64/128-plane candidates showed
10.2/23.7 nm inward residuals. Those versions are **rejected** and retained only
in [initial measurements](outer-results.json.gz).

Using the unmerged `transformation::convex_hull` triangle output for inversion
removes that defect without clearance. All smaller candidates report zero native
point containment error; the 128-plane result reports only 3.49e-18 m numerical
residual. Final candidate files below use this corrected construction. A scratch
union-with-native-points check also removed the residual, but that alternative
was not selected or banked as a candidate.

## Full-hull and candidate geometry

[Corrected construction measurements](outer-raw-results.json.gz) include all
budgets, native query observations and the original five aligned contact poses.
The input has 1,834 points; native reconstruction retains 1,832 vertices,
3,416 faces and 5,490 edges.

| Supporting planes | Candidate vertices | Worst outward error | Maximum gap in original aligned poses |
| ---: | ---: | ---: | ---: |
| 8 | 12 | 742.0 μm | 55.8 μm |
| 16 | 28 | 410.2 μm | 20.3 μm |
| 32 | 60 | 152.4 μm | 6.17 μm |
| 40 | 76 | 106.1 μm | 6.17 μm |
| 48 | 91 | 85.0 μm | 1.36 μm |
| 64 | 122 | 51.5 μm | 1.36 μm |
| 128 | 245 | 9.26 μm | 0.416 μm |

Every candidate preserves the source minimum Y exactly in the measured query
coordinates: `-3.279930493871319e-7 mm`. This tiny source roundoff is not replaced
with a new lift. Supporting-plane count describes construction, not necessarily
the final query shape's merged face count.

## Heading sweep changes the fidelity result

The original five cases all face π/2. That understates orientation-dependent
contact differences. [Expanded measurements](outer-compare-results.json.gz)
cover five unchanged XZ positions, eight headings in π/4 increments, and both
upright and original ray-normal-aligned orientations: 80 reference queries plus
80 per candidate, **320 total support queries**.

| Planes | Worst upright gap | Worst aligned gap | Native mean query time |
| ---: | ---: | ---: | ---: |
| 48 | 88.97 μm, x=-0.03 m, heading 3π/4 | 7.12 μm | 41.5 μs |
| 64 | 68.32 μm, x=-0.03 m, heading 7π/4 | 3.04 μm | 53.4 μs |
| 128 | 5.78 μm, x=0.03 m, heading 0 | 1.13 μm | 85.3 μs |
| Full native hull | Reference | Reference | 580.6 μs |

The 48-plane π/2 upright gap was only 4.17 μm; its wider heading result is why a
favorable screenshot cannot choose the collision representation. Expanded results
preserve every pose, not just the maximum. Query timing is a single native
release run, excluding asset preparation; it does not establish WASM, 20/100-fly
performance or complete movement cost.

The expanded 48/64/128 shapes have respectively 48/65/135 query faces and
267/360/729 edges. Compared with the full hull, those reduce the maximum SAT axis
work as well as support-map scans. Event workload is not accepted by that count.
Directional checks report no substantive negative support gap: the smallest
64/128 residuals are -4.44e-19/-8.88e-19 m, at floating-point roundoff.

## Artifacts and remaining gates

The numbered `*-planes.json` files contain only the source GLB hash and candidate
vertices. Matching compressed fixtures preserve the authored surface and all five
original XZ/ray-normal cases, with separate true `SupportSample` records for
upright and supported modes. Roots and witnesses are distinct. Those fixtures
use the original π/2 heading; expanded worst-heading data is in the full numeric
matrix and must inform visual judgment. The full-hull fixture supplies the
matching numerical reference.

[Eight-pose full reference](full-extra-fixture.json.gz) and
[matching 128-plane fixture](128-extra-fixture.json.gz) retain those five cases,
then append the worst upright pose for 48 planes (x=-0.03 m, heading 3π/4),
64 planes (x=-0.03 m, heading 7π/4), and 128 planes (x=0.03 m, heading 0).
Each added case includes both upright and original ray-normal-aligned core
samples, with the same XZ and authored surface. These are comparison inputs,
not a visual acceptance result.

Scratch generators remain in `/tmp/fly-rotation-probe/src/bin/outer_raw.rs`,
`outer_fixture.rs`, `outer_compare.rs` and `outer_extra_fixture.rs`; no production asset or API is changed.
The next decision requires visual comparison at relevant and worst headings,
followed by actual contact/movement verification. A candidate's outward error is
an intentional representation tradeoff, not a license to relax numerical contact
tolerance. No candidate becomes accepted merely because it is faster.
