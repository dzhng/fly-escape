# Release checks and measured limits

The user explicitly stopped further optimization and requested shipping the tested implementation. Functional release checks are complete; unmet performance and research targets remain disclosed, not relabeled as passes. The unfinished exterior-grass optimization was removed before the final build.

The production build and 24-tick native/browser one-fly smoke pass. The final review correction suite includes 147 client/renderer/web tests, typecheck, capture/cancel recovery, map retry and handled old-record behavior. The production path preserves exact recorded RGB and native pre-neural poses, and existing saved progress is separate from recording errors.

| Production UI diagnostic | Room 0 | Room 1 |
| --- | ---: | ---: |
| Computed and replayed ticks | 6,000 | 6,000 |
| Flies | 16 | 16 |
| Underruns | 0 | 0 |
| Frame p95 | 17 ms | 17 ms |
| Retained archive | 489.88 MiB | 489.60 MiB |
| WASM memory | 86.19 MiB | 89.25 MiB |
| Producer work with UI rendering | 253.00 s | 295.80 s |

Both runs exercised selection, pause, rewind and complete fast replay. Frame p95 covers the entire sampled run; occasional longer frames remain in the reports. The diagnostic horizon does not change either authored campaign timer. These reports use hardware Chrome 153, Apple M5 Pro, macOS 26.4.1, AC power. They do not establish performance on other machines. The final source corrections do not alter the frozen neural model or optical inputs.

## Limits retained at shipping

Ten measured warm retries had zero underruns, constant capture resource counts and about 0.69 MiB of retained main-heap growth. They **missed the latency targets**: cancellation-witness p95 was 371.5 ms, visible return 372.3 ms, and complete 16-fly acquisition through the real WASM binding copy 89.6 ms p95 (median 23.9 ms). The cancellation witness includes a catalog round trip and main-thread delivery, so it is an upper bound on cancellation completion rather than pure native cancellation time. The test-only build hook observes after the generated binding copies request/RGB, immediately before native computation; it is absent from the game build. An earlier excluded cold warmup buffered once; that negative observation is retained separately.

Profiling localized the return delay to regenerating approximately 795,000 grass clumps when the setup/playback camera footprint changes. This is bounded work, but expensive. The retained observation records the repeated 35 m/36 m footprint transition. The user chose shipping over further optimization; no landscape cache or artwork change was retained.

The [paired old/new comparison](../baseline-control/measurement/README.md) establishes changed gameplay outcomes in two seeded cases, with fewer escapes under the new input. It does not establish improved navigation. Color confirmation passes its declared two contexts; spatial v3 passes seven of nine contrasts but fails white-versus-gray128 and flight-doorway occlusion under the unchanged corrected-voltage criterion. Those research limits do not become successful claims because the functional feature ships.
