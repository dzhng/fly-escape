# Native shared-attempt feasibility

The production `Attempt` completed a full 6,000-tick, 20-fly active workload in **186.26 seconds**, or **3.22 simulated seconds per wall second**, on an Apple M5 Pro. A bounded 100-fly run sustained **0.615× real time**. This supports native feasibility for 20 flies on this machine; browser acceptance remains unmeasured.

| Flies | Measured ticks | Active neural steps | Step-loop seconds | Neural steps/s | Real-time ratio | Peak RSS (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 200 pilot | 4,000 | 6.40 | 624.7 | 3.12× | 99.36 |
| 100 | 200 pilot | 20,000 | 28.14 | 710.7 | 0.711× | 354.50 |
| 20 | 6,000 complete | 120,000 | 186.26 | 644.3 | 3.22× | 99.34 |
| 100 | 1,000 capacity | 100,000 | 162.68 | 614.7 | 0.615× | 354.34 |

The 100-fly longer run projects **976 seconds (16.3 minutes)** for 6,000 ticks. That horizon was not measured: the pilot already projected over 14 minutes, so the capacity follow-up was bounded to 1,000 ticks. Longer-run p95 tick latency was 38.01 ms at 20 flies and 204.98 ms at 100. The four runs were sequential on a shared interactive host, without CPU isolation; pilot variation is not a scaling advantage or a confidence interval.

Every tick checked that the active neural-step counter increased by the fly count and every fly emitted neural output. All 20 flies reached timeout on tick 6,000 with minimum observed reserve 628.68, and the next call returned no frame. The 100-fly capacity run ended with all brains active and minimum reserve 935.08. Walking and flying both occurred; no terminal no-op contributed to the rates.

The graph has 70,000 neurons and 798,715 edges. Its owner-reported array payload is **9,864,584 bytes**, shared once; each brain owns **3,220,000 bytes** of state arrays. Combined graph and brain payload is **74,264,584 bytes** at 20 flies and **331,864,584 bytes** at 100. These counts exclude fields, metadata, allocator and process overhead; `/usr/bin/time -l` peak RSS includes that overhead. Initial RSS is misleadingly low because initially zero pages become resident during stepping.

The benchmark uses production `Attempt`, one shared field, an active odor source, zero wind, no food or hazards, and unchanged default positive idle/walk/fly costs. Reserve capacity and initial reserve are explicitly raised to 1,000. A closed occupied room with a disconnected valid exit keeps the neural workload alive without disabling movement. These are load-test choices, not campaign tuning. Root seed is 42; the first 20 spawn poses are identical in both population sizes. Body defaults and the neural graph, noise and cadence are unchanged.

Frames are dropped each tick. The timing includes stepping, frame destruction, light telemetry and occasional progress writes; it excludes loading, initialization, result serialization, replay archiving, Worker transport and rendering. Native release performance does not establish WASM memory use, browser responsiveness or cross-device capacity.

The [raw evidence](native-throughput.json) contains all runs, exact level/tuning and build identifiers, source hashes and benchmark source, process logs, machine/compiler details and 200-tick block rates. The graph binary SHA-256 is `6218f74521ca39652c59bd7524fb6aa5fe587058ce438a3fa08e4d8eee7cd454`; simulation build ID is `5ab5bb69bff00d4e14b756819a2b6d6d821f6d0bbc561dc90af6277a19bd29c2`. The machine has 18 cores and 48 GiB RAM; the attempt executes sequentially with Rust 1.94.1, release opt-level 3 and thin LTO.

Reproduce on macOS with `cargo build -p sim --release --example attempt_probe`, then `/usr/bin/time -l target/release/examples/attempt_probe data/processed/brain 20 6000 /tmp/attempt.json`. Use `100 1000` for the measured capacity run. Validation: release build and all four active-work runs passed; `cargo test -p sim --lib` passed. The full run also checked one-time horizon completion. No optimization changes were made.
