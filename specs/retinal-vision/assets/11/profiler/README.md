# Development profiler amplification

A sixteen-fly run crashed near tick 2,790 with 228 MiB of retained record data and an out-of-memory error from `Performance.measure`. This was a real browser failure, not an archive-cap rejection. The initial full-run log records it; that run is not accepted performance evidence.

React 19's development component timing expands changed typed-array props into individual property descriptions. Passing the complete frame's 69,216-byte RGB swarm batch through `SciencePanel` produced a measured maximum of 138,625 property entries for one update. The performance timeline then retained cloned descriptions repeatedly. The archive itself was not passed by changing reference; a speculative archive-cache fix was unnecessary.

Playback now requests body/neural frame data without materializing the swarm's retinal batch. The default complete-frame reader still returns exact retinal data; selected eye panels read their one fly directly from the archive when painting. No optical information is removed from recording or replay.

The matched 200-tick probes reduce the largest observed timing description from 138,625 to 3,236 entries and observed frame-interval p95 from 51 to 17 ms. This is a focused development-runtime regression check, not full campaign acceptance. Heap snapshots in these reports are transient observations and do not establish retained memory. Full-horizon development and production runs remain required.
