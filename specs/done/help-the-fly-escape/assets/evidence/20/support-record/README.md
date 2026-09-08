# Recorded support and orientation

Component verification only. Schema3 preserves the core quaternion as four
Float64 values and food support identity as one Uint32 value. The core exports
field offsets by name and a no-support sentinel; the client reads those names
and sentinel. Null support means floor for grounded modes and no support for
flying/landing. Each record costs36 additional bytes per fly per tick; the same
128MiB archive ceiling and horizon rejection remain enforced.

The Rust encoder and native decoder reject non-unit/nonfinite rotations and
food support on airborne modes. The browser archive rejects the same invalid
states atomically before taking ownership of buffers. Initial metadata keeps
its supplied quaternion. No support ID is resolved against a second geometry
owner in the archive: the simulation owns the mapping within the attempt.

The production playback view interpolates recorded quaternions by the short
arc; the lifecycle view uses the recorded quaternion directly. Position remains
linearly interpolated. **Curved replay contact and ring conformance remain
unaccepted.** This pass makes no visual acceptance claim.

Verification: six native record tests;18 client tests/151 assertions;32 renderer
tests/380 assertions; TypeScript checking; focused strict Clippy. A real Chrome
probe imported this worktree's FrameArchive through Vite, decoded all four Rust
fixture frames exactly, and verified successful buffer transfer detached the
sender's buffers. The fixture includes food IDs0 and7, null support, and a
non-flat core quaternion. Existing browser harness coverage is unchanged.

The integrated core now writes upright orientation from the authoritative heading
at spawn and after motion; support remains null until physical acquisition is
accepted. Generated types and the actual release WASM have been rebuilt.
The integrated native body/record tests, client/renderer tests, TypeScript and
focused strict Clippy pass. A body regression checks a nonzero turn and terminal
freeze; removing the orientation update makes it fail.

[integrated-transport.json](integrated-transport.json) records the existing Chrome
Worker transport gate against the rebuilt WASM: all repeated-seed frames agree,
transferred buffers detach, hidden production stops within its existing credit
bound, and cancellation/reentrant restart checks pass. This establishes actual
transport integration, not curved physical motion or visual contact acceptance.
The proportions workbench and motion-context capture also consume recorded
orientation; fractional capture uses the shared renderer interpolation helper.

Review: kept the existing packed-buffer owner; added no retained frame history,
new dependency, compatibility reader, or parallel simulation. The archive-bound
calculation includes the new values/state. The test that synthesizes flying
modes now also clears food support to represent an actual airborne state.

## Next bounded consumer experiment

The [actual-request numerical reslice](../../../../README.md) supersedes the formal whole-interval agreement proposal. Replace sample-time support reprojection with one Rust-generated knot trajectory, consumed by body events and fractional replay. Preserve supplied starts and original neural intent. Query precision remains10nm; additional trajectory/replay error and visible maximum-close error have separate provisional diagnostic limits in the slice. Dense independent sweeps and halved-step convergence supply empirical evidence, not a formal all-instants certificate. No approximation allowance permits a physical gap to become edible support or a failed interval to become an obstacle.

Current playback in `apps/web/src/playback.tsx` reads endpoint frames and blends
position plus renderer quaternion interpolation. `FrameArchive` owns transferred
packed data, and Rust's record layout owns its128MiB bound. The diagnostic should
replace supported-path sampling through these owners, not add another physics
query in the renderer or rebuild recording independently.

A local initialization probe of the current built `game_wasm` module loaded no
graph/session:844,949module bytes,1,245,184initial memory bytes and5.55ms for one
Bun initialization. This is feasibility evidence for a stateless core evaluator
on the playback thread using the existing WASM boundary, not browser timing or
a committed runtime loader. Neural work and path construction remain in the
attempt Worker. Descriptor shape, archive bounds, main-thread evaluation cost
and cancellation/replacement lifetime still need actual diagnostic measurements
before implementation is selected. No production sampling changes in this note.

## Numerical knot storage constraint

A read-only layout audit at20flies ×6,000ticks reserves52.13MiB with no neural groups or81.43MiB with16groups under the existing128MiB archive cap. A conservative stored knot (fraction, root, heading, quaternion, support and flags) costs80bytes. With per-record offsets, the16-group case leaves room for about604,000knots, approximately five additional knots per fly-tick. A per-trace diagnostic cap cannot establish the total archive bound.

Keep FrameArchive as the sole retained-buffer owner and the Rust record layout as the budget owner. Reuse existing tick endpoints when identical and store only necessary interior/transition knots. Body events and playback must sample the same retained trajectory, including event-clipped endpoints and terminal holds at original tick fractions. A pure batched Rust sampler exposed through existing WASM can consume the requested tick or a bounded chunk cache without loading another brain or contact scene. Actual produced knot counts and sampler cost must be measured before choosing the final packed format. Any simplification belongs to the producer and must pass the contact/error contract before both body and replay consume it. A cumulative byte limit must reject overflow explicitly; it cannot silently truncate or simplify history.

A camera-owned projection probe loads the actual fly GLB (rest bounds3.861887×1.802078×3.279793mm), configures WorldCamera at1120×894CSSpixels and maximum-close follow, then projects vertical displacements at its ground pivot. The camera distance is23.394262mm:0.65µm projects to0.020954px,3µm to0.096719px and9.259275µm to0.298576px. This is a projection measurement, not a food-contact screenshot or orientation-independent bound. It shows why extra trajectory error and hull approximation need separate evaluation: submicrometre path error may be visually negligible while the candidate hull's largest deviation can dominate. Actual food-contact depth/orientation and raster evidence remain required.
