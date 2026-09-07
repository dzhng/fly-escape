# 29 — Curved-surface query feasibility

Status: replication accepted. The query module is now implemented under20; follow20 for body/record integration. Parent:20; dependencies:25. One question: can a bounded f64 geometry query find the first contact on curved fruit without a fast moving body crossing through it, while allowing departure and return?

## Candidate and limits

Replicate Parry's continuous shape casting first in a standalone native probe. Candidate dependency: parry3d-f64 0.30.2 with scalar enhanced-determinism, no rigid-body world or solver. Its time-of-impact query is a geometric constraint; it does not generate fly behavior. Use actual metre scales, a curved apple fixture and indexed triangle floor. Confirm misses, first contact, start-touching departure, revisit, initial penetration and stable ordering when multiple surfaces overlap a query. Native and WASM values now agree; see [evidence29](../assets/evidence/29/README.md). The accepted candidate normalizes queries internally to millimetres, preserving metre inputs/outputs; no clearance is required.

The probe ball establishes query feasibility; it is not the production fly shape. Slice20 now owns the measured native fly hull and its body/record integration. Successful casts alone do not prove walking adhesion, bounded slope transitions, feeding or replay; use slice20's current evidence and remaining gates for those claims.

## Proposed seam

A validated, immutable contact scene owns stable surface IDs and bounded indexed meshes in metre coordinates. Query inputs are the body's collision shape, pose and requested displacement; outputs are first impact fraction, surface identity, world contact point and outward normal. Invalid/nonfinite queries fail explicitly. Returned geometry may constrain a neural displacement but never select a destination or alter sensory currents. Floor contact is part of the same earliest-contact comparison. The body owner decides landing/feeding/support; the renderer consumes resulting recorded pose.

The replication should expose any approximation or dependency problem before creating public wire types. Adopt only the needed collision-query layer, not a second physics controller. No production contact change is accepted by this slice alone.

## Evidence and next action

Bank source and machine-readable native/WASM results under evidence29. Check first-contact analytic cases at millimetre scale, no-hit and separating motion, repeated determinism, and mesh contact witnesses. If the query candidate passes, materialize20's exact support/body shape and transition types; otherwise record the failed case and replace the candidate before dependent implementation.

Sources: [Rapier scene query contract](https://rapier.rs/docs/user_guides/rust/scene_queries/), [Parry shape casting](https://docs.rs/parry3d-f64/0.30.2/parry3d_f64/query/fn.cast_shapes.html). The pinned crate source, not latest documentation, is the API authority for the reproduction.
