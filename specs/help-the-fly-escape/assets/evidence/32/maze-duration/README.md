# Maze duration playtest

The player must guide a distant swarm through several rooms. Earlier same-room fan comparisons do not establish that this maze is playable.

Two browser attempts use the new first-house route, the actual placement/release UI, the same random seed, identical initial bodies and identical legal placements. The ten-minute attempt changes only the authored horizon through a test browser's module response. The production default remains five minutes. Fixed household objects remain present.

| Simulated duration | Escaped | Caught | Timed out |
| --- | --- | --- | --- |
| Five minutes | 0 | 1 | 19 |
| Ten minutes | 3 | 2 | 15 |

The ten-minute attempt needed100.45seconds of initial buffering. This single pair supports more time as a useful lever, not accepted balance or an estimate over players. No empty comparison has completed on this new layout yet. Reports retain the exact placements and seed; `content.json` contains current level and tuning for the continuous native diagnostic.

The browser harness uses normal buttons and floor clicks, with read-only renderer instrumentation to project those clicks and inspect positions. A controlled RNG supplies the matching seed. An earlier response replacement failed to recognize Vite's `3e3` duration representation and repeated five minutes; that failed diagnostic is excluded. The successful harness recognizes the transformed value and the report confirms6000ticks. A previous run timed out waiting for playback; the successful run records its long startup explicitly.

The user permits a60-minute diagnostic. The native scratch copy may raise its duration-validation maximum only, keeping one continuous Attempt, its neural state, random streams, fields and bodies. Restarting ten-minute segments is not equivalent and was rejected before collecting results. Browser archive limits and released game behavior are unchanged.

## Review limits

Fresh screenshot critique confirmed recognizable furnished rooms and doorway frames, and flagged weak room boundaries when multiple walls become transparent, a transient missing kitchen cabinet body, overflowing `TimedOut` labels and singular `1 stars` wording. The text labels were corrected; the renderer issues are recorded for focused follow-up and no new visual-quality acceptance is claimed. The review did not infer gameplay balance.

A separate code review found that a departure finishing after the replay horizon could consume background-tab time. The visibility handler now suspends that presentation timestamp directly; the focused clock test covers hiding without an intervening animation frame. Typechecking and the route/departure tests pass. The long-running duration diagnostic remains independent of these presentation edits.
