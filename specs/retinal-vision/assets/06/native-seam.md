# Native optical tick transaction

This preparatory pass makes native optical stepping usable through an explicit
constructor. Campaign starts remain on the baseline path until capture and exact
record packing are integrated. The optical quality profile remains provisional;
passing these state tests does not accept its visual quality or acquisition cost.

[`Attempt`](../../../../crates/sim/src/attempt.rs) owns one pending request. It
snapshots active flies before any field, neural or body update. A complete matching
batch is validated and converted for every active fly before the shared tick loop
runs. A rejected batch leaves the pending request available and simulation state
untouched; cancellation permanently invalidates the attempt. A failure during
actual stepping remains terminal because that state cannot safely be retried.

The committed frame owns the consumed request and RGB bytes. This includes eyes
consumed on the tick a fly becomes terminal; subsequent requests exclude that fly.
An empty active set still permits the remaining timed-round ticks. The existing
record encoder rejects these frames until slice 07 can preserve their observations.
It cannot silently publish an optical tick with missing pixels.

The native [protocol](../../../../crates/sim/src/vision.rs) owns wire types. The
[WASM session](../../../../crates/game-wasm/src/attempt_session.rs) carries request
metadata as JSON and RGB as a byte buffer, checks chunk capacity before preparing,
and uses the same native transaction. It introduces no scheduler, polling loop or
second neural loop. The generated TypeScript declarations expose this boundary.

The [map loader](../../../../crates/sim/src/graph/retinal.rs) binds the exported map
to the graph, source annotation, optical profile, layout, rig, frozen color model
and baseline visual budget. Profile/layout/color hashes cover the exporter's raw
canonical JSON subobjects plus a newline; preserve the exported bytes. Native
[sensory conversion](../../../../crates/sim/src/sensory.rs) applies the frozen
response to each RGB sample before local spatial weighting. Gain zero is an
ablation, not permission to omit the observations.

The immutable attempt configuration also binds the complete map file's SHA-256.
Two spatial assignments can use the same source annotations and optical profile;
they are still different attempt inputs and cannot share that map identity.

## Verification

- `cargo test --workspace`: all native tests pass, including baseline movement,
  record and attempt checks.
- `cargo check -p game-wasm --target wasm32-unknown-unknown`: passes.
- [Transaction tests](../../../../crates/sim/tests/retina_tick.rs) cover repeated
  preparation, full nontrivial body transforms, identity/shape/finite-pose
  rejection without partial state changes, duplicate commit, cancellation,
  generation replacement, terminal transitions, empty active batches and exact
  per-fly neural input. The session test also exercises metadata JSON round trips
  and capacity admission before preparation.
- [Map tests](../../../../crates/sim/tests/retinal_map.rs) compare all exported
  uniform and spatial fixture currents against the independent Python oracle,
  within `1e-12`, and reject invalid targets, channel changes, support and dose.
- Fault injection proved the tests fail: removing request equality admitted a
  wrong fly; zeroing mapped current disagreed with the gray stimulus oracle.
  Both changes were restored before the green verification run.
- Independent Codex review found no actionable defects in the preparatory seam.

This verifies the native runtime and the WASM adapter on the host, plus WASM
compilation. Real browser acquisition/cancellation/context-loss and native-versus-
WASM numerical execution remain slice-06 integration gates. Record schema 07 and
the archive admission budget remain required before optical campaign use.
