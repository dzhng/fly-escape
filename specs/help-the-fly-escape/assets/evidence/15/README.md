# Open Window exploratory calibration

This checkpoint is **not accepted campaign content**. The current JSON is unfrozen and failed the placement-effect feasibility gate. No 30-seed or held-out evaluation has run. Each report preserves its exact content, content hash, graph identity, paired seeds, outcomes and sampled body positions; earlier candidates remain evidence, not alternative runtime owners.

The native probe runs the real Graph and Attempt with 20 independent flies. It validates positive increasing star thresholds, disjoint 30-seed sets, legal placements through Attempt, and the fixed authored room topology using actual body sweeps. Its topology sampler assumes room IDs 1–4 ordered along +x and pantry 5 above room 2; general campaign topology validation is future work. Counts below 30 are explicitly diagnostic. A single report cannot accept the whole campaign gate.

| Pilot | Reference escapes | Poor escapes | Empty escapes | Verdict |
|---|---|---|---|---|
| Initial straight route | 19/20/20 | 20/20/20 | — | Auto-success; rejected |
| Side window | 0/0/0 | 0/0/0 | — | Wall trapping; rejected |
| Moderate turn | 5 | 3 | — | One-seed signal only |
| Stronger scent | 6/3/5 | 3/1/2 | — | Median gain +3; below +4 |
| Local exit cue | 6/3/5 | 3/2/3 | 2/0/3 | Median gain +2 |
| Gain three | 6 | 3 | 2 | No improvement |
| Longer duration | 6 | 3 | 2 | Extra time did not unstick flies |
| Compact | 7 | 4 | 3 | One-seed gain +3 |
| Compact wrong route (current JSON) | 7/5/5 | 4/5/3 | 3/2/4 | Median gain +2; failed feasibility |

The current candidate reaches one star on 3/3 tuning seeds, but that small sample does not establish 27/30 reliability. Empty controls demonstrate some placement benefit without relying solely on a deliberately poor arrangement. The best three-seed gain remains below the required +4. Stalled and boundary-stalled counters plus actual sampled poses expose persistent wall trapping. SVG traces connect sparse samples and must not be interpreted as exact collision paths.

Native first-tick latency was roughly 0.03–0.05 seconds with graph loading measured separately. This is diagnostic evidence, not the browser MVP performance gate; runs overlapped other local work. Browser integration, final visuals, route comprehension and human review remain open.

Run the example with `GRAPH_DIR CONTENT_JSON tuning|heldout COUNT OUTPUT_JSON`, optionally adding `--empty-control`. Held-out execution requires frozen content. The seven malformed-content guards in guard-checks.json passed before graph loading. Parent independently reviewed the real Attempt/Graph ownership and report design; requested threshold and complete-set hardening is included.

## Decisions and next experiment

Geometry was compacted only in this level JSON; the house workbench fixture remains unchanged. Body speeds/turn response, field diffusion, inhibitory odor gain, explicit taste gain, reserve/duration and legal placements use existing validated interfaces. No neural graph, source groups, steering or app UI changed. Thresholds stayed positive at 1/8/15; they were not reduced to manufacture success.

The next bounded experiment holds this compact geometry and both placement sets fixed and changes all spawn headings from 0.4 to 0.25 radians, using the same three tuning seeds and empty controls. If this auto-succeeds, try 0.325. No held-out seeds may inform tuning. Only a credible pilot signal justifies freezing content and running both complete 30-seed sets.
