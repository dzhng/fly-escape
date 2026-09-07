# Edge-to-edge support feature

This component evaluates the actual edge/edge feature identified by the sampled SAT probe at the turn boundary. It does not yet choose transitions or certify continuous motion. The scratch source is `/tmp/fly-rotation-probe/src/bin/edge.rs`; [raw measurements](edge-feature-results.json.gz) retain all domain checks near both ends.

## Geometry and domain

For triangle edge `a→b` and native hull edge `v→w`, let `e=b-a`, `h=q*(w-v)` and choose `n=h×e` with positive Y. The supporting root height at chosen XZ is `n·(a-q*v-rootXZ)/n.y`. This is the exact coplanarity equation for the two edges. Parallel edges and a zero vertical normal require another feature representation; this fixture does not encounter them.

Solve `root+q*v+s*h = a+t*e` by the two-edge Gram matrix. A valid local contact requires both segment fractions `s,t` within[0,1], the separating normal inside the hull edge's adjacent-face normal cone, and the triangle's third vertex on the supporting side of the plane. The reconstructed hull topology supplies the adjacent faces. These checks exclude an infinite-line intersection outside the actual edge segments.

Unlike retained face/vertex support, the normal rotates here; root height is a ratio of trigonometric expressions. The face-domain event solver cannot be copied unchanged and assumed to cover these intervals.

## Measured fixture

The known triangle201 edge[122,82] and reconstructed hull edge[1084,1312] are retained for this test. No automatic discovery is claimed. Across2,001 headings from0.69 to0.75rad,102 sampled poses satisfy the local domain, from0.71532 through0.71835rad. Every valid sample agrees with the whole-apple support oracle within3.16e-11m; maximum reconstructed edge intersection residual is2.63e-17m. The first sampled fraction is not an exact domain boundary.

Local evaluation averaged about50ns in100,000 native release calls. It excludes all candidate discovery, global competitor checks, event isolation, asset preparation and WASM overhead. It is evidence that an individual feature is cheap to replay, not a swarm performance result.

Near entry, the hull segment fraction reaches its endpoint. Near exit, the triangle's third-vertex plane margin reaches zero. These give concrete transition constraints for the next path owner. This test does not establish absence of competing contact between samples, discover all features or solve apple departure. Root reviewed equation signs and domain ownership; independent review was unavailable because the agent thread limit rejected the request.

## Pure-turn local events and the entry tie

For fixed root XZ, edge segment fractions can also be expressed analytically. Let `d=a-rootXZ-q*v`, `B=Y·(q*(w-v)×e)`, `S=Y·(d×e)` and `T=Y·(d×q*(w-v))`. The segment fractions are `S/B` and `T/B`. Rotational cross products simplify using `q*v×q*h=q*(v×h)`, so these numerators, the denominator, adjacent-vertex cone margins and the third-triangle-vertex margin are all constant-plus-sine-plus-cosine functions. The existing scalar domain solver applies to this fixed-XZ fixture. Translation introduces time-times-sine/cosine terms and remains a separate unresolved extension.

Starting at the incoming face walk's heading0.7152927668385065 exposes a numerical tie: the hull segment's endpoint margin evaluates to−4.22e-15, and the raw scalar solver reports an immediate exit. [Raw events](edge-events-raw.json.gz) preserve that failure. It is not meaningful physical motion and must not trigger repeated zero-time handoffs.

The [incidence experiment](edge-events-incidence.json.gz) anchors only that known endpoint predicate to zero at entry, evaluating cosine-minus-one as−2sin²(half-angle) to avoid cancellation. It changes the scalar predicate by its bounded residual, not the root path or geometry. All other constraints remain unchanged. The local next exit is the third-triangle-vertex margin at heading0.7183536334028212, consistent with the independent sampled edge evaluation. No clearance is added.

Independent mathematical review accepts this only as a proposed symbolic boundary identity. Production must carry the incoming event's triangle edge, hull endpoint and root/time bracket; an endpoint ID plus a small residual is insufficient proof of incidence. The residual is about2.47e-14 of the hull segment parameter. The coefficient-scaled threshold remains an arithmetic guard until event-time uncertainty is included. Require strictly positive `B`: even a tangent zero makes the height/segment formulas singular and must end the feature interval. The measured interval has no denominator root. This experiment does not yet establish a robust general transition policy or continuous global safety.

The [independent edge check](edge-inventory-audit/README.md) confirms that this
specific full-hull edge is active and both adjacent faces are supporting planes.
The raw-edge inventory defect therefore does not invalidate this local edge/tie
interpretation; broader SAT discovery remains unaccepted.
