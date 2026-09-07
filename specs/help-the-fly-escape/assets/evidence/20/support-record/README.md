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
orientation; fractional capture uses the shared client interpolation helper.

Review: kept the existing packed-buffer owner; added no retained frame history,
new dependency, compatibility reader, or parallel simulation. The archive-bound
calculation includes the new values/state. The test that synthesizes flying
modes now also clears food support to represent an actual airborne state.
