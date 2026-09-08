# Two playback modes

The clock owns Real time and Fast. Fast derives its multiplier from the authored duration so the full horizon occupies one minute; early completion finishes sooner. The campaign defaults to Fast. Switching modes retains the cursor and checks the required buffer lead again. Simulation and recorded outcomes are unchanged.

Root reviewed Claude's implementation, passed11 clock tests and the integrated TypeScript check, and ran the real Chrome playback harness. The browser exercises both buttons, mode switching, pause, seek, recorded neural agreement, replay and restart; its captured10-minute diagnostic horizon uses10× in Fast. This is control/recording evidence, not a full timed campaign acceptance or a new art review. Five-minute campaign completion, buffering wait and sustained performance remain to be measured after the timed core integrates.

The sustained retry harness retains Real time as its default full-attempt check and accepts explicit `RETRY_MODE=fast` for the campaign default. Its completion timeout derives from the authored horizon and selected multiplier. Both paths enforce normal cursor traversal, measured frames, terminal outcomes, hardware rendering and zero underruns. Fly cards omit the inactive reserve readout; neural education remains.
