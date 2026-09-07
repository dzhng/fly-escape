# 20 — Authoritative furnishing and food contact

Status: **in progress**. Native contact, body integration, recorded curved motion and a controlled actual-graph banana meal are implemented. Remaining gameplay gates are recorded revisit, robust contact and sustained twenty-fly cost. Cosmetic contact refinement is deferred by the user’s MVP visual acceptance; functional transition/replay checks remain required. Dependencies: 19,25,26 and the physical-adapter verdict.

## Contract

Visible furniture and food must agree with physical geometry. Solid footprints own furniture collision, fields and placement; appearance identity belongs to that same solid. Native food and household contact use authored metre geometry with stable surface IDs. The renderer consumes recorded poses and exported geometry rather than solving a second simulation. Decorative details cannot imply blocked traversable routes.

Eating requires physical edible contact and the existing neural feeding signal. Supporting a fly does not automatically make an object edible. Prove approach, landing, feeding, departure and revisit on curved fruit, with a replenishment-disabled control that keeps geometry, taste, odor, seed and neural parameters identical. A renderer-only height offset, invisible enlarged food region or goal-directed steering is not an acceptable substitute.

Twenty real-connectome flies, deterministic replay and the existing performance budgets remain required. Controlled motor tests establish body mechanics; actual-graph attempts establish reachable behavior. Neither alone proves a useful campaign puzzle. Arbitrary furniture climbing and general six-axis flight are outside this slice.

## Current ownership

`crates/sim/src/surface.rs` owns native contact queries and normalized geometry. The attempt prepares one immutable contact scene shared by its flies. `BodyWorld` loads the native fly hull from `assets/fly/contact-hull.json`; the hull is now used in production, not an unused candidate.

`crates/sim/src/body.rs` and `body/` own root height, orientation, support, contact transitions and reserve. Support IDs can identify edible or nonedible surfaces. Airborne landing cannot feed before touchdown; grounded edible contact is distinct from blocking contact. Losing support does not authorize teleportation or immediate reacquisition at the old pose.

Core-generated timestamped motion knots and the WASM sampler serve body events and recorded playback. The archive carries height, quaternion, support and motion; the renderer adds no physical height. Native tests cover landing, feeding, edge departure, neighboring surfaces, terminal freezes, takeoff and legitimate apple reacquisition/refeeding. See `crates/sim/tests/body.rs` and `crates/sim/src/body/motion_consumer.rs` for the authoritative cases.

Runtime bounds and accepted workload are separate questions. Motion currently limits points and contact queries; the contact scene limits surfaces and the archive caps bytes. The general supported subdivision is coarser than the departure subdivision. Read `body/motion.rs`, `body.rs`, `surface.rs` and `packages/sim-client/src/record.ts` for current limits. Enforcing those limits is not evidence that representative twenty-fly sustained contact finishes within release budgets.

A verified collision may stop motion. Specifically unresolved angular sweeps decline the turn while preserving the exact preceding orientation and still testing translation. Malformed queries remain errors. Query, segment, knot and substep exhaustion now discard provisional movement and retain an independently validated starting pose within the same fixed budget; see the [captured query failure](../assets/evidence/30/query-budget-contact/README.md). This conservative policy is recorded in the [seed 42 regression](../assets/evidence/30/seed42-contact/README.md); it does not permit suppressing arbitrary errors as obstacles.

## Evidence and its limits

- [Surface kernel](../assets/evidence/20/contact-kernel/README.md) records native/WASM agreement and normalization. [Query feasibility](29-surface-query.md) and [failed formal certification](../assets/evidence/20/support-path-feasibility/actual-body-requests.md) explain the numerical method; the rejected certificate program is not pending implementation.
- [Native root/pose diagnostics](../assets/evidence/20/contact-root/README.md) and [vertical motion](../assets/evidence/20/vertical-motion/README.md) establish coordinate ownership. Uniform shading cannot establish microscopic foot planting.
- [Furniture identity](../assets/evidence/20/furniture-identity/README.md) verifies catalogue dimensions, rotated placement, model loading and resource ownership. Shape/material/light/furnished-visibility acceptance belongs to 21–24.
- [Flat feeding comparison](../assets/evidence/20/feeding-benefit/README.md) and [native banana meal](../assets/evidence/20/native-banana-meal/README.md) establish actual-graph replenishment benefit. The banana capture includes landing, feeding and departure; only one of twenty streams eats. This selected opportunity is not attraction or campaign calibration.

The renderer currently uses a planar selection circle aligned with body orientation and adjusted for pixel width. It does not conform to curved fruit. The [outer-edge contrast correction](../assets/evidence/20/ring-contrast/README.md) makes the yellow circle readable on banana. Prior apple-indentation clipping remains open, alongside unclear mouth contact, competing trails and missing close surface detail. Do not claim those resolved from native contact assertions.

## Remaining reviewable gates

1. **Contact accuracy; presentation refinement deferred.** Preserve query regression precision. The provisional numerical ceiling is 3 µm additional trajectory/replay error relative to the chosen hull, targeting zero penetration; reject measured excursions above it. The earlier maximum-close 0.25 CSS-pixel appearance target is deferred under the user’s current visual acceptance. Use dense temporal checks and halved-step convergence as empirical evidence, not a proof at every instant. Further cosmetic ring/contact refinement is deferred; preserve the existing visible marker.
2. **Complete recorded lifecycle.** Extend the curved-fruit production playback evidence through a legitimate revisit. Existing native tests force motor outputs and therefore do not alone satisfy this recorded actual-behavior gate. Preserve pause, reverse seek, support acquisition/loss, departure and terminal freezes on the same sampler. Keep the matched replenishment control and twenty independent streams.
3. **Sustained work and archive cost.** Measure representative twenty-brain contact production, archive use and playback cost against existing budgets. Demonstrate forward progress and bounded failure handling. The favorable selected meal and seed 42 run are baselines, not worst-case workload proof.
4. **Visual review accepted for MVP; future refinement deferred.** The user accepts current appearance. The following earlier capture plan is retained for future art work, not as a blocker to playable levels: Capture full frames and tight fly/food crops at default, close follow, further zoom and widest wheel zoom, including contact transitions. There is no Overview button. Use the actual renderer/player; Blender renders are authoring evidence only. Preserve all captured states for independent review rather than selecting the best ones.

These gates complete this slice's original scope; they do not replace campaign attraction, two-level balance or final release acceptance. One meal is progress, not permission to close the remaining gates.

## Review discipline

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for prior/candidate visual changes and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) for independent inspection. Contact alignment and transitions are this slice's visual variables; detailed photoreal materials remain with later slices. Preserve the supplied reporter framing when responding to a visual defect. Open review shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); human feedback remains non-blocking while independent work continues.

No blind neural-gain changes, scale changes, clearance padding or hidden steering are delegated here. Evidence belongs under this slice's assets; keep the root handoff and choices ledger aligned with any changed contract.
