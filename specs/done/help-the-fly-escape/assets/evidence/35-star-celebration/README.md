# Replay celebration verification

The browser fixture changes scoring thresholds at the worker boundary to exercise unseen milestones deterministically. The visible zero-escape counters in these captures reflect that fixture; these images are layout evidence, not simulation or scoring evidence. The real replay/archive, worker computation, controls, and celebration component remain connected.

Browser checks cover paused computation without celebration, first watched milestone, automatic dismissal, usable pause controls, no repeat after seeking backward, a jump to the highest milestone, and completion without another celebration. The milestone unit test uses real escape-count inputs and was verified to fail when the watching guard was removed, then pass after restoration. Type checking and all web tests passed. Independent Codex review found no actionable defects.

The fresh visual review found the compact banner touching the counter. The final compact capture has a clear gap, and the follow-up review found no remaining banner defects. Existing right-panel content continues below its scroll viewport; it is unrelated to this overlay. The full captures and enlarged banner crop preserve the review evidence.
