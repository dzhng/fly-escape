# Yield between simulation ticks

The production Worker must let cancellation and replacement messages run after every tick. A nested zero-delay timer introduced a minimum delay even when messages were absent. A Worker-owned MessageChannel keeps the task boundary without timer clamping. Only one pump and one awaited callback exist, and terminating the Worker owns channel cleanup. Buffer policy, credit limits, WASM and simulation inputs are unchanged.

The browser CPU trace of the first 500 ticks on the integrated build recorded 501 Worker timer callbacks, median 4.064 ms and 1988.472 ms combined delay. The candidate trace has no Worker timer callbacks. Traces are compressed here; profiling overhead makes them diagnostic rather than release timing evidence. See the browser timer rule in [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#nested_timeouts).

A separate, unprofiled pair ran the full production second house, seed110, twenty flies, five simulated minutes and the same fan/two-vinegar arrangement. Both harness processes exited zero.

| Measurement | Timer | Message channel |
| --- | ---: | ---: |
| Initial buffering | 37.718 s | 18.415 s |
| Production | 79.758 s | 62.775 s |
| Frame interval p95 | 17 ms | 17 ms |
| Underruns | 0 | 0 |
| Escaped / timed out | 4 / 16 | 4 / 16 |

All 300 chunks match in per-field byte lengths and FNV checksums across motion, neural values, states, events and neural-step counts. This is recorded-stream checksum evidence, not a cryptographic or exhaustive all-seed equivalence claim. The change does not touch numerical simulation. One paired run demonstrates this improvement, not sustained platform acceptance; background machine load remains uncontrolled.

The actual browser transport suite also passed: hidden production drains only its two credited chunks then stops; repeated runs retain identical recorded frames; cancelling a running twenty-fly attempt emits no later accepted frames; a replacement finishes. TypeScript, client tests and production web build pass. Independent lifecycle review found no concurrency defect: the pumping flag spans the yield, so new work cannot overwrite the pending callback.

Final ten-attempt production, input, memory and actual-platform gates remain open. The current candidate passes the startup threshold on this measured arrangement without changing that threshold or reducing buffer safety.

The parallel [read-only consultation](consultation.txt) is retained as raw advice, not accepted findings. Its estimate that per-tick scheduling costs less than0.1seconds is contradicted by the actual trace and full comparison above. Its table also mislabels the earlier pre-integration delivery trace as an integrated gameplay run. Root rejected the resulting claims that changing noise is the only large remaining lever and that startup cannot be closed without it. Constant motor-exclusion caching, loop fusion and contact reuse remain unmeasured candidates; none was implemented. Avoid extrapolating subsystem percentages across different builds, workloads or profiles.

Firefox155 production smoke also passes with the rebuilt Worker: setup/models, twenty-fly playback, pause and seeking, cancel to setup, and a fresh retry; no page errors. The [report and captures](firefox/report.json) preserve observed capabilities and timing. This short engine check is not a completed campaign or an actual Safari check.
