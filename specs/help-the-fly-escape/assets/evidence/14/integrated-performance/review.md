# Full integration performance checkpoint

A complete 600-second 1× run performed 120,000 active neural steps, with zero underruns and frame p95 17 ms. Startup was 1452 ms and active production averaged 2.10× realtime. The adjacent JSON records the exact setup/core build identity. This is one affected integration run, not a substitute for the earlier ten-run baseline.

The [matching memory probe](../integrated-memory/browser-memory.json) conservatively estimates 261,930,060 owned bytes (about 250 MiB), including the full archive bound, observed heaps, same-build WASM high water and estimated GPU allocations. Browser/compositor/driver overhead is excluded. Later solid geometry/campaign builds have their own release checks; these measurements do not silently transfer to a different build.
