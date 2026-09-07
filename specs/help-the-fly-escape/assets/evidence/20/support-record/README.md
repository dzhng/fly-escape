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

These gates used a temporary, uncommitted BodyState seam in an isolated worktree
(initial support null, initial rotation from the existing core support_rotation).
The consumer commit intentionally excludes body.rs. Physical movement integration
must regenerate types and rerun the native/browser transport gates before this
can be banked as integrated behavior. The Chrome probe verifies decoding, not
physical movement or production rendering.

Review: kept the existing packed-buffer owner; added no retained frame history,
new dependency, compatibility reader, or parallel simulation. The archive-bound
calculation includes the new values/state. The test that synthesizes flying
modes now also clears food support to represent an actual airborne state.
