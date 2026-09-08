# Shared WASM noise angle calculation

The noise draw needs sine and cosine of the same angle. WASM now uses libm::sincos to share argument reduction; native keeps platform sine/cosine. RNG draws, ordering, distribution and neural rules are unchanged. libm was already locked transitively; the simulation now directly depends on it only on WASM.

Two alternating actual WASM20-fly500-tick measurements were20351.9/18325.9ms and20123.8/18751.3ms (baseline/candidate): mean wall time decreased8.4%. These are bounded Node measurements, not browser startup or full-round acceptance. [Raw timings](bench.txt), [harness](bench.mjs).

The500-tick complete step/chunk digest matched:60536ed1628ca354c1df273251489438f8c6ec30c9090a7bac15241a586e178e. [Digests](digest.txt). Additional actual-WASM probes compared three70,000-neuron streams,25ticks of paired brain dynamics and an odd70,001-sample tail, with no bit differences. [Probe output](equality.txt). This is strong bounded equivalence evidence, not an exhaustive proof over every angle or future compiler/library version. The simulation build identity still changes with source.

The production change is one private platform helper and its dependency edge. An independent noise-stream regression test includes the odd tail and fails on a swapped sine/cosine negative control. Root integration reference and attempt suites pass23tests. No renderer, body, content or public schema change is needed. The native noise path still computes the same functions; source delivery was already optimized in the baseline.

Review: root inspected the entire four-file patch and raw measurements. Rejected the delegate's stale suggestion that the baseline still used the old full connection scan and its projected full-round timing as release evidence. Browser verification and root production digest are recorded separately when complete.

The independent [probe source](probe/src/lib.rs) and its [manifest](probe/Cargo.toml) are preserved as evidence, with their original scratch paths. Reproduction requires updating those paths to the checkout/package being tested. These files are outside the workspace and are not shipped.

Root rebuilt the production WASM and independently reproduced the same500-tick digest ([output](root-digest.txt)). The first full Chrome Fast attempt completed but failed the zero-underrun gate: one buffering interruption,62.7s initial wait,105.85s production, p9517ms. Concurrent native trials were running; this is not an isolated speed comparison. [Attempt](concurrent-attempt-1.json), [failure](concurrent-failure.json). The buffer policy is under separate investigation; this optimization is not release acceptance.

An isolated full production Chrome run passed:45.544s initial wait,90.281s production, no underruns, framep9517ms, all20timedout at3000ticks. [Report](isolated-attempt-1.json). Its [final frame](isolated-attempt-1.png) is byte-identical to the sparse-delivery baseline (SHA2564f91a98469f7d4fd7f80b5a051bd7af629e9236e283e42e302558f5d77906f81). The preceding baseline observation was48.397s wait and94.993s production; these individual browser observations do not estimate a stable percentage gain. Startup remains above target and the concurrent-load interruption remains open. Root formatting, typecheck and production builds also pass.
