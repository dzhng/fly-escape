# Office release and stronger finish pull

These measurements describe the layout shipped in `17a2402`. The user subsequently requested closing the hall-to-living-room shortcut; they do not measure that later, indirect route.

The first house now releases on open office floor. A broader office opening and a direct hall-to-living doorway shorten the route to the exit room. The original office banana remains a distraction: player placements must overcome built-in lures. Both houses use stronger physical exit suction, still gated by room membership, visibility and swept collision/escape checks.

## Progression evidence

The native probe runs the actual neural graph and continuous attempt using the player’s saved ten-object plan. No neural tuning changed. These are bounded four-minute observations, not complete ten-minute balance results.

| First house candidate | Seed | Left starting room by 4 min | Escaped by 4 min |
| --- | --- | --- | --- |
| Original bedroom release | 17884844139807819042 | 11 | 1 |
| Bedroom, stronger suction only | 17884844139807819042 | 11 | 4 |
| Final office and wider route | 17884844139807819042 | 11 | 5 |
| Final office and wider route | 20260908 | 14 | 8 |
| Final office and wider route | 20260909 | 14 | 5 |

Final office first-minute departures were 5, 6 and 5, respectively. The canonical final configurations and results are `probe/office-open-route.json` and `probe/office-open-route-results.json`. The source and other candidate inputs/results are retained in `probe/`; `office-open-route-lure` is a rejected experiment that relocated the default banana, and does not describe shipped behavior. Foot-of-bed and narrow-door candidates are also superseded. Incomplete early probes are labeled in `exploratory-checkpoints.json`. Object contact sticking remains deferred.

## Finish verification

`tests/browser/exit-capture.mjs` supplies sixteen nearby starting bodies to the real WASM worker, leaving neural activity and physical movement intact. All sixteen physically escaped at tick 16 (1.6 simulated seconds). The three replay frames and `exit-capture.json` retain that result. The deterministic body regression also verifies walking and flying bodies moving maximally away from either door facing still escape from two metres within five seconds.

All 36 body tests, all 6 web tests, typecheck, WASM build and the production web build passed. Independent Codex review reported no actionable correctness issues. `office-setup.png` captures the final office Start marker, widened passage and unchanged banana; crops support close inspection.

## Visual inspection

Root inspection and an unprimed critique found readable Start/Finish labels and no clear prop depth inversion or broken exterior opening. The critique identified dense overlapping flies and conspicuous white trails at the exit; this fixture deliberately packs sixteen bodies into a tiny patch, so it proves capture timing rather than representative swarm presentation. The translucent office doorway uprights and overhead strips can read as disconnected rails (medium confidence), and the playback panel covers part of the bedroom corner. These presentation limitations are recorded for later work; this pass verifies the changed route and finish behavior without claiming those limitations are resolved.
