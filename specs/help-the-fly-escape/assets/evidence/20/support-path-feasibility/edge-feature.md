# Edge-to-edge support feature

This component evaluates the actual edge/edge feature found by the complete oracle at the turn boundary. It does not yet choose transitions or certify continuous motion. The scratch source is `/tmp/fly-rotation-probe/src/bin/edge.rs`; [raw measurements](edge-feature-results.json.gz) retain all domain checks near both ends.

## Geometry and domain

For triangle edge `a→b` and native hull edge `v→w`, let `e=b-a`, `h=q*(w-v)` and choose `n=h×e` with positive Y. The supporting root height at chosen XZ is `n·(a-q*v-rootXZ)/n.y`. This is the exact coplanarity equation for the two edges. Parallel edges and a zero vertical normal require another feature representation; this fixture does not encounter them.

Solve `root+q*v+s*h = a+t*e` by the two-edge Gram matrix. A valid local contact requires both segment fractions `s,t` within[0,1], the separating normal inside the hull edge's adjacent-face normal cone, and the triangle's third vertex on the supporting side of the plane. The reconstructed hull topology supplies the adjacent faces. These checks exclude an infinite-line intersection outside the actual edge segments.

Unlike retained face/vertex support, the normal rotates here; root height is a ratio of trigonometric expressions. The face-domain event solver cannot be copied unchanged and assumed to cover these intervals.

## Measured fixture

The known triangle201 edge[122,82] and reconstructed hull edge[1084,1312] are retained for this test. No automatic discovery is claimed. Across2,001 headings from0.69 to0.75rad,102 sampled poses satisfy the local domain, from0.71532 through0.71835rad. Every valid sample agrees with the whole-apple support oracle within3.16e-11m; maximum reconstructed edge intersection residual is2.63e-17m. The first sampled fraction is not an exact domain boundary.

Local evaluation averaged about50ns in100,000 native release calls. It excludes all candidate discovery, global competitor checks, event isolation, asset preparation and WASM overhead. It is evidence that an individual feature is cheap to replay, not a swarm performance result.

Near entry, the hull segment fraction reaches its endpoint. Near exit, the triangle's third-vertex plane margin reaches zero. These give concrete transition constraints for the next path owner. This test does not establish absence of competing contact between samples, discover all features or solve apple departure. Root reviewed equation signs and domain ownership; independent review was unavailable because the agent thread limit rejected the request.
