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

The [actual-request numerical reslice](../../../../slices/20-furnished-contact.md) supersedes the formal whole-interval agreement proposal. Replace sample-time support reprojection with one Rust-generated knot trajectory, consumed by body events and fractional replay. Preserve supplied starts and original neural intent. Query precision remains10nm; additional trajectory/replay error and visible maximum-close error have separate provisional diagnostic limits in the slice. Dense independent sweeps and halved-step convergence supply empirical evidence, not a formal all-instants certificate. No approximation allowance permits a physical gap to become edible support or a failed interval to become an obstacle.

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
