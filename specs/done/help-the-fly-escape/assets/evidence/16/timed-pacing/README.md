# Faster second-house movement

The larger house now uses walkSpeed0.24 and flightSpeed0.48 rather than0.12/0.24. Five-minute duration, neural cadence, motor readouts, turning, contact, inventory and geometry remain unchanged. The smaller introductory house keeps its existing movement pace. The user explicitly permits increasing movement when traversal takes too long.

The [paired pacing pilot](../../30/second-house-pacing/README.md) improved empty-map escapes from0,0 to4,3; this is a traversal improvement, not proof of puzzle balance. A [doorway candidate](../../30/doorway-ablation/README.md) is being checked on fresh seeds before final thresholds or acceptance.

Root production Chrome ran the saved three-object setup on seed110 for the full3000ticks:4escaped,1zapped,15timedout; no starvation, no underruns, framep9517ms. Initial wait36.901s, production74.316s. [Attempt](attempt-1.json), [resource report](report.json). The level/tuning hashes match the corresponding native2× candidate exactly, and all three saved placements are present. The actual outcome matches that native trial too. Root inspected the final follow-camera capture for the recorded fly and result; no art or visual-quality improvement is claimed.

Root typecheck, web build and three campaign topology/control tests pass. The browser still uses the full graph and20flies. No invisible contact enlargement or direct steering was introduced. Final seed calibration, difficulty and release gates remain open.
