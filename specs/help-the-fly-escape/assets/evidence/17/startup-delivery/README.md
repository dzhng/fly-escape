# Startup delivery trace

One full production Chrome run of the existing second-house seed110 three-object
arrangement, captured before firing-readout integration. The Worker listener only
records arrival timing; the normal app computes and plays the actual recording.
Other integration work was active, so this is a delivery trace under observed load,
not a clean isolated speed comparison against the older capture.

Results:4escaped,1zapped,15timedout, zero underruns, matching the earlier run.
Initial wait51.258s; production98.296s. Framep95 was34ms, **failing the25ms gate**.
The wrapper therefore exited1 after saving the actual attempt/timeline. The neural
readout had not changed in this capture. Renderer counts increased modestly after
the user-requested presentation work, but this does not isolate the cause of the
slower production or frame timing.

Assets were ready1.346s after worker readiness. First play was50.994s after readiness.
Offline, the earliest launch that could consume this exact chunk schedule without
running out was38.811s; retaining one second of reserve raises it to39.811s. The
policy waited11.183s beyond that hindsight bound. The bound checks each arrival
against the previous available tick, at5× playback, and includes asset readiness.
It is **not** a safe predictor for a different seed or future machine load.

This rules out asset loading or padding alone as a complete solution to this run's
startup problem. Keep the current no-underrun policy while measuring production
cost on the integrated gameplay build. The recorded frame-time failure remains open.
