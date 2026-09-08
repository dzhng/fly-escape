# First-house collision regression

Resolved by retaining verified poses when angular or translational contact cannot be accepted. The original captured request and failure remain here; [native diagnosis and reduced cases](resolved/report.md) explain the two invalid motion candidates that preceded the missing-support panic.

The native fix preserves the exact previous orientation when a swept turn hits geometry or returns the collision library’s typed unresolved result. Translation still runs. A penetrative impact candidate retains the last verified pose. Neither neural outputs nor precision/work limits changed. Zero-time landing also retains its support identity.

The rebuilt production browser run uses the same first-house seed 42 and twenty flies. It finishes at tick 311 with two escaped and eighteen starved, matching native results, zero console errors and zero buffer underruns. All five pause, reverse and resize pixel comparisons pass. [Browser evidence](resolved/browser.json) records Apple M5 Pro hardware rendering, a 1.34-second initial wait and 17 ms frame-interval p95; these are one-run measurements, not release-wide performance acceptance. The [restored frame](resolved/restored.png) preserves the house after resize.

This closes the captured collision regression. It does not establish reliable food-seeking, meaningful eating or final campaign balance.
