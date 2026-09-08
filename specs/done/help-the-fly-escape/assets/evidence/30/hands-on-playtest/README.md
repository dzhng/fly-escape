# Hands-on playtest of the current browser build

Played through the normal UI at `http://127.0.0.1:5322/` in the in-app browser, before any firing-decoder integration. No injected placements, seeds, unlocks or outcomes. CUA screenshots and accessibility observations are in the task conversation. These are individual natural swarms, not paired statistical comparisons or precise wall-time benchmarks; deliberate pauses extended viewing time.

| Round | Arrangement | Escaped | Other outcomes | Stars |
| --- | --- | ---: | --- | ---: |
| First house | Apple near the living-room opening | 12 | 8 timed out | 2 |
| First-house retry | Fan on clear floor behind the starting area | 7 | 13 timed out | 1 |
| Second house | Apple along the hall route, banana near the kitchen window, vinegar behind the study start | 1 | 2 zapped,17 timed out | 1 |

All rounds reached the five-minute timer and awarded results. Retry preserved editable arrangements, removing/replacing objects worked, the first result unlocked the second house, and Real time/Fast switching and pause/resume worked. Fly-card selection changed the selected fly and moved into close follow. This establishes playable timed rounds; it does not establish balanced levels or prove which placement caused a score.

## Player friction to investigate before more tuning

- Saved stars and unlocks revealed the computed result early. During round one, the top navigation already showed two stars and unlocked the second house while playback still had3:16 left and showed seven escapes. The final result was12 escapes. Save/display progression consistently with the intended replay reveal.
- Two clicks directly on clearly visible, paused fly models left selection and camera unchanged; clicking Fly02's card worked. Reproduce at the same zoom before claiming a picking defect or fix. The attempted model coordinates were523,465 and432,489 in the1265-wide screenshot.
- Attempts begin closely following Fly01. Watching the swarm required substantial zoom-out and drag panning; a brief close-follow view became almost entirely wall. These are functional visibility observations, not a request for another art pass.
- A seemingly open fan position was rejected with “object overlaps a reserved prop or spawn footprint.” Moving farther from the start worked. The protected starting footprint is not apparent to the player.

The second house mostly felt like watching wandering flies, with little clear feedback linking my arrangement to their choices. That supports trying the already-measured attraction candidate in actual play; it does not justify more strength matching or smoothing.

The browser viewport changed to559px during the test; one subsequent coordinate click missed because of that change, and is not counted as a game defect. At that width the setup's two-column layout leaves a very narrow map. A temporary1280×900 desktop override allowed the second-level placement test and was reset afterward.

The user explicitly requested playtesting before further changes. Integration agent65458 was terminated with exit143, leaving partial uncommitted edits only in `/tmp/fly-spike-integration`. No code was integrated or rebuilt during these three rounds. All other experiment agents are terminal. Current CUA browser tab1 is marked for handoff.
