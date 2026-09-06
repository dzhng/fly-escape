# Bounded trail preparation

The archive reads at most 40 packed poses per fly on each integer tick change; the oldest ten establish mode-transition context before the visible 30-tick window. This leaves neural decoding out of the trail path. The renderer uses the shared flyHeight function, fixed vertex capacity, a two-world-unit length cap and playback-age opacity. Recorded input/result discontinuities break the path; terminal records stop generating points. A single renderer-owned mesh shares the existing teardown path.

Client16/renderer15 tests and typecheck pass. Tests compare pose-only values with actual native record fixtures, then check clipping, alpha range, future exclusion, terminal stop, discontinuity and exact reverse-seek geometry. They establish behavior, not appearance. Production capture, pixel comparison, independent visual review and affected performance checks remain open.

Shape review moved transition-context decoding out of the renderer and into the archive. No Worker/schema change or retained full history is added. Existing animation and archive tests remain green. The 40-tick window's leading samples provide context; they are not advertised as a complete animation history before that window. The internal renderer consumer always uses the full window and displays at most the last 30 ticks.
