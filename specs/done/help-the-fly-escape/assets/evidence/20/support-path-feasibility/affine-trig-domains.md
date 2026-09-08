# Affine rotating-domain root isolation: mathematical direction

**Verdict: the reduction is mathematically sound; no working numerical solver
or continuous motion is accepted by this note.** A separate agent checked the
identities, root-count argument, endpoint cases and degeneracies. This is a
possible bounded replacement for sampled searches when translating rotation
produces affine sine/cosine coefficients.

For a normalized interval `t∈[0,1]`, consider

`f(t)=A+Bt+(C+Dt)cos(θt)+(E+Ft)sin(θt)`, with `0<θ≤π`.

The differential operator removes the affine trigonometric terms:

`h=f''+θ²f=θ²(A+Bt)+2θFcos(θt)−2θDsin(θt)`.

This is the simpler linear-plus-trigonometric family already investigated in
the scalar event probe. Its derivative extrema are analytic. Let

`g=cos(θ(t−1/2))` and `s=gf'−g'f`.

Then `g>0` in the open interval, `s'=gh`, and `(f/g)'=s/g²`. Consequently, all
roots of `h` partition monotone intervals of `s`; all roots of `s` partition
monotone intervals of `f/g`. Each stage can isolate a strict sign-changing root
by bisection after checking every partition boundary for zeros. Boundary-zero
checks are essential for tangencies; sign changes alone are incomplete. The
last stage can evaluate `f` for signs rather than divide by `g`.

## Finite root counts and special cases

For non-identically-zero functions, there are at most three distinct roots of
`h`, four of `s`, and five of `f`. Indeed,

`h'=θ²(B−2Fsin(θt)−2Dcos(θt))`,

`h''=2θ³(Dsin(θt)−Fcos(θt))`.

Unless identically zero, the second expression has at most one interior zero
over this phase interval. Rolle's theorem bounds roots of `h'`, then `h`, then
`s` and `f/g`. These are distinct-root bounds, not multiplicity bounds.

- `θ=0` reduces directly to `(A+C)+(B+D)t`.
- `h≡0` means `A=B=D=F=0`: `f` is a pure sinusoid and `s` is constant.
- `s≡0` means `f=kg`; handle its endpoint roots directly unless `k=0`.
- `f≡0` has infinitely many roots and must be represented as an identity.

At `θ=π`, use `g=sin(πt)` and treat endpoints separately. Here
`s(0)=−πf(0)` and `s(1)=πf(1)`. The quotient is undefined there. If an endpoint
is a simple root, its inward quotient limit is `f'/g'`, rather than zero;
higher multiplicity needs the corresponding expansion. A certified inward
sign or Taylor expansion is needed for adjacent bracketing, otherwise a second
interior root can be missed. The total five-root bound still holds: `m` interior
roots and `e` endpoint roots of `f` require at least `m+e−2` interior roots of
`h` by the same Rolle argument.

## Numerical limits

Finite root count supplies no minimum root separation. Nearly coincident roots,
tangencies, nearly homogeneous coefficients and small `θ` can cause severe
cancellation. Ordinary tolerances plus a fixed number of bisections do not
certify signs or completeness. A numerical implementation must establish
certified bounds/adaptive precision, or return an explicit unresolved result.
An unresolved query cannot silently become a safe moving path or a permanently
stalled fly. Feature incidence and endpoint contact need their own geometric
meaning; this scalar argument does not supply it.

Constraints with higher harmonics are outside this reviewed family. Global
competing-feature completeness, archive bounds and body integration remain
separate work; this direction is not a mandatory architecture choice.
