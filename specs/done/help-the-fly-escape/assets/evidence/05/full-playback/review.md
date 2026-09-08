# Sustained buffered playback

Ten complete 600-second 1× browser runs each performed 120,000 active neural steps (20 flies × 6000 ticks), reached the final record and had no errors or underruns. These are uninterrupted full-duration runs, not terminal no-op throughput. Chrome 152 on Apple M5 Pro / 48 GiB, 1440×1000 at DPR 1; each adjacent JSON preserves build identity and measurements.

| Run | Startup ms | Active production rate | Frame p95 ms | Underruns |
| --- | --- | --- | --- | --- |
| 1 | 1322 | 2.27× | 17 | 0 |
| 2 | 1126 | 2.17× | 17 | 0 |
| 3 | 1176 | 2.06× | 17 | 0 |
| 4 | 1126 | 1.80× | 17 | 0 |
| 5 | 1128 | 1.99× | 17 | 0 |
| 6 | 1094 | 2.09× | 17 | 0 |
| 7 | 1226 | 1.94× | 17 | 0 |
| 8 | 1128 | 2.11× | 17 | 0 |
| 9 | 1125 | 2.03× | 17 | 0 |
| 10 | 1094 | 2.28× | 17 | 0 |

The baseline passes the ten-run gate. It measures the recorded simulation build, not future mixed-cue or campaign builds. The current integrated renderer/science memory estimate is [246 MiB](../../13/integrated-memory/browser-memory.json); the [100-fly capacity probe](../browser-capacity.json) remains a scaling limit, not a support claim. UI/transport correctness and visual reviews are recorded in the parent evidence folder. No new production behavior or architectural decision is introduced by this evidence pass.
