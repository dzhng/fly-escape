# Deliver only active neural connections

The runtime graph stores outgoing connections by source neuron. The downloaded artifact remains incoming-row CSR and is validated before transposition. Visiting spiking sources in ascending order preserves each target's original addition order; one runtime matrix replaces the old one. Noise generation, neural parameters, fields and body behavior are unchanged.

## Verification

Root reviewed the final production files against Claude commit `bca3e40`; they match. Root only shortened a test comment. The integrated numerical reference, graph-rejection cases, attempt tests and32library tests pass. The WASM/web build passes. The cancellation-sensitive reference test uses asymmetric edges, changing source activity and silencing; it asserts exact floating-point bits against an incoming-current oracle.

The supplied500-tick actual-graph trace hashes voltage, spikes, refractory state, diagnostics and motor/group readouts. Baseline and candidate share hash `251308f828034385c41b1e567320723738f3ee714d4b49f08a3394566be6a837`. This is a bounded trace plus an order-preservation argument, not an exhaustive trajectory audit.

The native20-fly benchmark processes50020active fly-ticks:87.57seconds baseline,43.47seconds candidate. Graph-array storage stays9864584bytes. This closed-room benchmark is not a campaign result. The [Claude report](claude-report.md) describes the checks and measured outlier; its claim that simulation does not gate build identity is incorrect—`Attempt::new` compares the supplied specification against the current build identity. This optimization changes that identity even while preserving neural arithmetic.

## Actual browser

On static production Chrome/Apple M5 Pro, second-level seed11716541513791412824 completed the whole3000-tick attempt at5×. Startup48.40seconds, production94.99seconds, zero underruns, frame interval p9517ms. The preceding implementation measured98.37seconds startup and145.12seconds production on the same seed; these are individual observations, not isolated repeated timing trials. Startup remains above the engineering target and requires further measured work.

All20flies timed out in both runs. Root compared initial bodies, final camera data and outcomes: identical. The final screenshot is byte-identical to the timed-policy baseline (`4f91a98469f7d4fd7f80b5a051bd7af629e9236e283e42e302558f5d77906f81`). This verifies unchanged visible output at that frame, not every intermediate body trajectory or overall puzzle balance. The harness also checks countdown, the two speed choices, terminal accounting, no starvation and Worker/canvas reuse.

Raw benchmark and browser reports retain identities and memory measurements. Final campaign calibration, ten full real-time attempts and platform/resource gates remain open. No noise-stream change or dependency was introduced.
