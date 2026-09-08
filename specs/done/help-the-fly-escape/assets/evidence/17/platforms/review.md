# Browser engine smoke preparation

The same locally served production build loads the real graph and twenty flies in Chrome 152, Firefox 155 and Playwright WebKit 26.6. Each engine starts an attempt, pauses without cursor movement, selects fly 20, and restores the same recorded neural readout after seeking away and back. All report no page errors. `report.json` retains graph, simulation, level, tuning and actual seed identities. The screenshot set records Overview and selected states; seeds differ, so these images are not pixel-comparison evidence across engines.

This is a bounded correctness smoke, not full-episode performance or final campaign acceptance. Playwright WebKit is not the installed Safari application; actual Safari coverage remains explicitly absent. Full release checks must rerun after the campaign and remaining art settle. The first probe read the pre-publication report immediately after clicking Pause; it was corrected to wait for the observable paused state before measuring stability, matching the existing playback harness. No application pause behavior changed.

Browser dependencies were installed through Playwright. The initial download ran out of local disk space; the attempt was stopped, obsolete task-owned Rust build caches were cleaned with cargo, and a later installation succeeded after free space recovered. No user data was removed.
