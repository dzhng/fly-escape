# Coarse directional vision

Each fly samples eight horizontal light directions in the simulation. The sample travels with the recorded pre-neural pose through the worker and browser archive. Looking around with the player's camera cannot change it. Odor retains its separate antenna sampling.

The detector uses modeled lamp bearing and distance, with a cosine response around each bin. Walls and furniture block light through the same conservative footprint geometry used by the environment. The shade tool darkens its local region. These are deliberately coarse optics: low furniture remains opaque even to a flying fly, and there are no retinal pixels, vertical rays, reflections or inferred MaleCNS retinotopy.

## Why this shape

Eight directions preserve brightness and bearing without eight rendered cameras or a second environment owner. One visibility query per source is sufficient for the simple point-light model. Fixed arrays keep per-fly sampling allocation-free. A source-times-obstacle limit rejects excessive combinations instead of omitting blockers; the existing source limit also bounds angular work.

Each direction records received brightness and the contribution removed by geometry or shade. Removed light is diagnostic simulation telemetry, not a claim that a fly knows about invisible lamps. The visual adapter consumes received brightness only. Its existing bilateral groups and binary winner rule remain unchanged here; it now compares directional hemisphere means rather than two antenna brightness readings. Circuit interpretation and graded response require separate experimental evidence.

The record format advances to schema 5 with sixteen appended numbers. Old in-memory attempts are rejected by version; saved campaign arrangements are unaffected. The native layout owns wire offsets and the browser reads them by field name. Received and blocked brightness saturate at one million modeled units, including intermediate and diagnostic field accumulation, to keep extreme finite source rates from overflowing records. This numerical ceiling is unrelated to biological receptor sensitivity.

## Invariants and evidence

- Bin zero faces the fly's input heading; successive bins rotate by 45 degrees in increasing simulation heading. Record exactly the sample used before that tick's neural update; do not recompute it from a playback pose.
- Visual samples contain no exit direction, motor command, odor concentration or player-camera input.
- A wall or furniture footprint can remove a lamp contribution; openings restore visibility. Uniform ambient alone cannot choose a lateral side.
- Terminal ticks without sensory input remain absent. Seeking and rewind read the original values, including all blocked-light channels.
- The existing 128 MiB archive cap, 16-fly campaign, 2/5/10 stars and About page remain unchanged.

The [native measurements](assets/native/measurements.json) report 0.0031–0.0077 ms per sixteen-fly sensory tick across both campaign rooms and optical fixtures, using 160,000 samples per condition. Three paired 100-tick, sixteen-fly runs show median overhead of +0.59% on the active-neural fixture and −1.39% on the authored Open Window room. The [measurement scope](assets/native/README.md) identifies tuning and short-window limitations. Both local speed gates pass. The full native suite passes 173 tests; 38 client/web tests and type checking pass. Deliberately forcing visibility true fails the wall regression; deliberately zeroing decoded brightness fails four cross-language tests, which pass again after restoration. Native capacity checks accept twenty flies over 6,000 ticks; the smaller sixteen-fly campaign also stays within the unchanged cap. Independent integration review found no actionable defect.

The [browser report](assets/browser/report.json) checks exact native-fixture decoding in the browser, a real 16-fly worker run with a lamp, and production campaign playback through pause and reverse seeking. It observed zero underruns during that bounded check; it does not claim a complete-round pacing test. The [production paused frame](assets/browser/paused-rewind.png) and [independent visual review](assets/browser/visual-review.md) preserve the existing fly, roster and controls. No new sensory interface is introduced by this change.

## Code pointers

[FieldSet and VisionSample](../../../crates/sim/src/environment/fields.rs) own sensing and numerical limits. [Geometry](../../../crates/sim/src/environment/mod.rs) owns visibility. [cue_currents](../../../crates/sim/src/sensory.rs) consumes the directional hemispheres. [Native records](../../../crates/sim/src/record.rs), [FrameArchive](../../../packages/sim-client/src/record.ts) and the [cross-language fixture](../../../crates/sim/examples/record_fixture.rs) own exact replay. [Environment tests](../../../crates/sim/tests/environment.rs) pin rotation, brightness and blockers; [browser checks](../../../tests/browser/directional-vision.mjs) cover the live consumer. The [choices ledger](choices.md) records the modeling tradeoffs.
