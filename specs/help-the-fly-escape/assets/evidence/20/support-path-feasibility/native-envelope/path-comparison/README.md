# Native envelope path comparison

**Verdict: smaller point sets materially reduce measured work, but feature-path
adoption is blocked by invalid reconstructed topology.** Point-support containment
and downward support casts remain distinct from face/edge correctness. This pass
changes no production solver, candidate geometry, clearance or numerical tolerance.

## Scope

The reference is the full native hull; the derivative is the durable candidate
prepared in `e03665b` on the integration branch (identical to `411ca7c`). The apple,
metres and millimetre query normalization are unchanged. The existing SAT-domain
probe constructs the upper boundary of triangle-minus-hull configuration obstacles
along XZ `[20,-3]` to `[20,3]` mm. Four fixed orientations cover heading 0/1.5 rad
and tilt parameter 0/0.7, with up `[tilt,sqrt(1-tilt²),0]`.

Each path is checked at 2,001 fractions against independent core `support_at`
queries for both shapes. These dense checks are validation evidence, not a
continuous proof. The represented fixed-orientation paths are piecewise linear;
no rotating segment solver was added.

## Reconstructed topology fails before path evaluation

[Topology measurements](topology.json.gz) reproduce Parry's face-halfspace check
without panicking, so the magnitude and feature IDs remain inspectable.

| Shape | Stored edges | Active incidence edges | Maximum face violation |
| --- | ---: | ---: | ---: |
| Full | 5,490 | 5,245 | 1.22e-13 mm |
| Candidate | 729 | 378 | 3.2676 mm |

`edges()` retains deleted internal triangulation edges after face merging. They
are not all physical feature edges. Deduplicating `edges_adj_to_face()` removes
that source of invalid planes, but is insufficient: candidate face 105 excludes
point 87 by millimetres. The original scratch shortcut used a face/edge witness
as its support-plane offset, producing missing spans and large incorrect heights.
Core downward queries still return support at those fractions. The first
upright miss after incidence filtering is fraction 0.8, **only in the SAT path**.

The unmerged `transformation::convex_hull` topology also fails: five triangles
violate a source-point halfspace by more than 1e-8 mm; maximum violation is
3.2676 mm at triangle 315. Simply orienting normals away from the centroid flips
two triangles but leaves a 0.4453 mm violation. Raw triangulation alone is not a
validated replacement. The raw worst triangle's double area is 2.20e-4 mm².

The [original rejection](original-sat-rejection.json.gz),
[incidence-only envelope rejection](active-incidence-envelope-rejection.json.gz)
and [incidence-only rotating rejection](active-incidence-coverage-rejection.json.gz)
are retained. These reject the scratch topology assumptions, not the candidate's
point-support containment. Parry's point projection uses its support map; the
constructor does not invoke its own `check_geometry` assertion.

## Projected plane offsets: measured workload, incomplete inventory proof

Computing each SAT plane offset from global point projections makes every plane
contain the configuration obstacle even when its claimed witness is wrong. This
repairs the measured paths. It does **not** establish a complete face/edge direction
inventory when reconstructed topology is invalid, so this is not solver adoption.

[Projected-offset paths](projected-envelope.json.gz) have no missing samples or
uncovered intervals. Reference timings and segment counts are in the full-shape
rows of the incidence-only envelope artifact above.

| Fixed orientation | Full build / total | Candidate build / total | Full / candidate spans selected | Maximum candidate–full root difference |
| --- | ---: | ---: | ---: | ---: |
| Upright | 27.64 / 35.36 ms | 2.21 / 3.67 ms | 15 / 8 | 9.77 μm |
| Turned | 32.16 / 36.59 ms | 2.27 / 3.74 ms | 4 / 15 | 8.31 μm |
| Tilted | 14.11 / 18.61 ms | 1.99 / 3.37 ms | 5 / 5 | 2.84 μm |
| Turned and tilted | 12.74 / 17.23 ms | 1.96 / 3.32 ms | 4 / 5 | 4.18 μm |

Build includes triangle filtering, plane construction, polygon clipping and
upper-envelope knots; total additionally includes file parsing and native hull,
mesh and scene construction. Selected-span counts coalesce identical winning
span IDs, not every geometrically collinear neighbor. All paths retain 50 apple
triangles. Timing is one native release run, excluding dense reference checks.
Maximum candidate path-versus-own-core discrepancy is 1.66e-13 m; full is
1.12e-11 m. Vertical root difference can exceed directional support error on slopes.

## Wide turn and tilt failures remain relevant

[Projected-offset coverage](projected-coverage.json.gz) repeats 1,001 fractions
for turn 0→1.5 rad, tilt 0→0.7, and their combination at fixed XZ. It queries the
whole local candidate set every time; it does not construct continuous rotating
segments. Candidate means are 1.00–1.02 ms/evaluation versus full 5.31–5.34 ms.
The maximum candidate discrepancy from its core query is 2.36e-12 m; deepest
static contact is -9.54e-17 m. Maximum full-reference root differences are
8.33/3.18/6.40 μm respectively. Every sampled query succeeds.

[Unmerged projected-offset paths](unmerged-projected-envelope.json.gz) and
[coverage](unmerged-projected-coverage.json.gz) corroborate sampled heights but
cannot validate the faulty topology. Rotating evaluation costs 2.36–2.43 ms.
Neither inventory provides an accepted continuous contact guarantee.

[Retained-feature comparison](retained-feature.json.gz) confirms that a smaller
hull does not remove domain events: the original candidate feature first leaves
its vertex cone at fractions 0.331/0.597/0.283 for the wide turn/tilt/combined
paths. Continuing it blindly gives up to 0.861 mm error. These are sampled first
failures, not exact event times. Triangle changes and global competitors remain
necessary; local feature validity alone is insufficient.

## Next bounded gate

The candidate needs a validated supporting-plane and incidence representation
before event-path work can rely on its topology. Its original construction planes
are a possible source; reconstructing from almost coplanar points again has not
passed. No evidence here permits adopting the projected-offset workaround as a
complete moving solver. WASM and actual 20/100-fly workloads remain unmeasured.

Scratch sources remain in `/tmp/fly-rotation-probe`: `envelope_compare`,
`coverage_compare`, their unmerged variants, `feature_compare`, and
`check_candidate_topology`; no research solver is shipped by this evidence pass.
