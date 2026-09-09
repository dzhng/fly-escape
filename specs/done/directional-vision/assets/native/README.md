# Native directional sensing evidence

[Measurements](measurements.json) preserve the machine, compiler, exact sampling positions, checksums, timing scope, workload and paired results. The release [sampling probe](../../../../../crates/sim/examples/vision_probe.rs) measures the production sensory entry point, including antenna diagnostics and wind. Campaign samples span open floor; optical fixture samples lie inside the authored lamp/shade region, because a spatially broad sample set can miss a small source entirely. Checksums agree across repeated runs and differ between the lamp and shade fixtures.

The measured full sixteen-fly sensory tick is below 0.008 ms for both campaign rooms and below 0.004 ms for both optical fixtures. Each timing uses 160,000 samples after warmup. This clears the 1 ms local target; it makes no hardware-independent claim.

Three alternating release comparisons, each with sixteen active flies and 100 ticks, show median time changes of +0.59% in the existing active-neural workload and −1.39% in the authored Open Window room. Both clear the 10% overhead gate. The campaign comparison uses the existing attempt probe with only its level construction replaced by the authored Open Window `LevelDef`; its cue tuning remains the probe's excitatory-odor gain of one. This is a computational comparison, not campaign outcome validation. Short-run timing noise and other local CPU work remain limitations.

The complete native suite passed 173 tests. For a negative control, forcing every visual source visible made the wall-loss regression fail with facing brightness 3 where ambient-only brightness 1 was required. Restoring visibility made the suite pass. Existing record roundtrips now carry distinct nonzero bins across ticks, preserving terminal absence.

Shape, diff and documentation review retain FieldSet as the sensing owner and reuse the existing record channel. Independent Codex review found only the schema mismatch with the TypeScript consumer, which is owned by the concurrent integration pass. Native completion alone must not be read as browser acceptance.
