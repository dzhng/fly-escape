# Retained-feature domain events

**Probe verdict: analytic partitioning is feasible; no production acceptance.**
[Numeric results](events-results.json.gz) preserve eight asserted synthetic cases
and three native retained-feature paths. Source remains
`/tmp/fly-rotation-probe/src/bin/events.rs`.

For linear root XZ and shortest quaternion interpolation, Rodrigues' formula
makes every rotated vertex component constant plus cosine plus sine. The
retained triangle-face height formula is linear in those components. Therefore
each adjacent-vertex cone inequality and triangle barycentric inequality is:

```
f(t) = a + b*t + c*cos(theta*t) + d*sin(theta*t) >= 0
f'(t) = b + theta*(-c*sin(theta*t) + d*cos(theta*t))
```

Derivative zeros follow from one sinusoid plus a constant. Since shortest-slerp
`theta <= pi`, at most two interior derivative zeros split the interval into at
most three monotonic pieces. Crossing roots are isolated by 52 bisection steps;
stationary zeros and endpoints are checked separately. A tangent touch is a
boundary event, but not a domain exit if both neighboring intervals remain
nonnegative. Initial negative motion exits at zero. Zero-angle constraints are
linear; an identically zero constraint marks the whole interval as boundary
rather than inventing isolated roots.

The mathematical partition cannot skip an intermediate crossing the way time
sampling can. Its floating-point implementation still needs a numerical contract:
near-zero stationary values are compared with a coefficient-scaled roundoff
threshold. Near-tangent ambiguous cases must not silently certify validity in a
production owner. This experiment does not supply interval arithmetic or a formal
floating-point error enclosure.

Synthetic assertions cover positive/negative/zero constants, linear exit,
initial exit, endpoint contact, tangency and two crossings. The latter finds
`1/6` and `5/6`; tangency finds `1/2` without an exit. The solver uses at most 113
function evaluations among those cases. The fixed analytic partition and
bisection schedule imply fewer than 200 evaluations per constraint for this
bounded angle range, excluding verification against the direct pose formula.

For apple triangle 201 / reconstructed hull vertex 1423, all four cone and three
barycentric constraint formulas agree with 1,001 direct pose evaluations within
4e-15 in their respective numerical units (cone projections use millimetres;
barycentrics are dimensionless). First vertex-domain exits are:

| Path | Earliest cone exit | Neighbor |
| --- | ---: | ---: |
| 1.5 rad turn | 0.26189175505224516 | 1639 |
| tilt ending at up.x = 0.7 | 0.1464572504662106 | 120 |
| combined turn/tilt with 0.05 mm XZ displacement | 0.16763851214770875 | 120 |

The stale vertex's turn path reaches a triangle boundary at
0.3345931458329693. That is not the correctly updated face walk's exit: changing
vertices changes the active formula. Tilt and mixed paths here use quaternion
slerp, unlike the earlier linear-up-component probes, so their fractions differ.

Next: perform adjacent-vertex handoffs with root-height continuity, emit analytic
segments until the first triangle-domain exit, and forbid repeated zero-time
handoffs. Any neighboring-triangle overtake remains a global validity failure;
local domain events alone do not establish nonpenetration.
