# Timed-campaign placement pilot — open-window (first level)

Bounded pilot, 15 complete attempts, native Rust `Graph` + `Attempt`, no browser/GPU,
no Python/controller motion approximations. Production settings, graph, neural wiring,
geometry, duration and motor behaviour untouched; the durable implementation diff of this
pilot is empty (the harness lived in an untracked example that has been removed).

## Regime under test

Timed policy (`bodyConfig.life.kind = "timed"`), `durationTicks = 3000` (5 min at
0.1 s/tick), 20 flies (10 spawned flying), star thresholds [1, 8, 15]. Feeding/starvation
deferred; landing and walking retained. No fan in any arm. Old finite-energy balances do
not carry over and were not used.

## Identities (identical across all 15 attempts)

| field | value |
| --- | --- |
| graphHash | 6218f74521ca39652c59bd7524fb6aa5fe587058ce438a3fa08e4d8eee7cd454 |
| manifestHash (sha256 of manifest.json) | ead5f7d258f83ee3909080797752c2f4bb749be939a2ff983f411095722efbf1 |
| simulationBuildId | a9fd04c52fafa73be8ba1f7459cc73ee719b2ef4a5820b565649626329e52e5f |
| levelHash (canonical LevelDef) | 59992fd13e6ad976841264cc734967053eb8249338ed7fe592c55c861222b456 |
| tuningHash | 59b4eb3640c5c6cbd2c0e8d0a99240cbc13cebd527870d5e1c874f92ddf6defb |
| levelSourceHash (apps/web/src/levels/open-window.ts) | 2e93fe496de6d454f537eae5f60feb0b0b5f5686f97d78318f01d6e24cabc386 |
| pilotSourceHash (source/placement_pilot.rs) | 348f61a24b78297eaab00438497c2d423ba312f8ea08ee67ce9581ffe439ecbd |
| neurons / edges | 70000 / 798715 |
| worktree commit | e228262 plus the root candidate's uncommitted diff (`source/uncommitted-candidate.diff`) |

Level content is read from the shipped TypeScript module, so the pilot cannot drift into a
private copy of the level. Every plan was accepted by the production owner
`sim::placement::resolve_placements` before any attempt was constructed; the check was
verified to bite (a fruit inside the sofa is rejected).

## Plans

| label | placements |
| --- | --- |
| empty | none |
| apple | fruit (1.6, 2.3) — prior coordinate |
| vinegar | vinegar (4.2, 2.35) — prior coordinate |
| combined | both prior coordinates |
| combined-exit-adjacent | fruit (0.35, 2.25) + vinegar (5.4, 2.55) |

Exit opening is x = 0, z ∈ [1.8, 2.7], outward −x; spawn cluster is x ∈ [3.0, 3.45],
z ∈ [2.0, 2.7]. Both prior coordinates are legal on the current level.

## Paired escapes per seed (out of 20)

| plan | seed 100 | seed 101 | seed 102 | mean | per-seed diff vs empty | mean diff |
| --- | --- | --- | --- | --- | --- | --- |
| empty | 5 | 10 | 9 | 8.00 | 0, 0, 0 | +0.00 |
| apple | 6 | 9 | 11 | 8.67 | +1, −1, +2 | +0.67 |
| vinegar | 6 | 6 | 9 | 7.00 | +1, −4, 0 | −1.00 |
| combined | 5 | 8 | 12 | 8.33 | 0, −2, +3 | +0.33 |
| combined-exit-adjacent | 11 | 10 | 9 | 10.00 | +6, 0, 0 | +2.00 |

Hazards and timeouts: starved 0 and zapped 0 in all 15 attempts (as expected — timed
policy, no zappers on this level). Caught: 1 fly, once, in `combined` seed 100 (spiderWeb
at (4.49, 8.9), room 4). Every other non-escape is a timeout at tick 3000. Timeouts are the
complement of escapes in every run.

## Route diagnostics

Occupancy is share of live fly-ticks per room (room 1 holds the exit); dwell is fly-ticks
within 0.4 m of a placed object.

| run | room-1 share | dwell | median escape tick |
| --- | --- | --- | --- |
| empty 100/101/102 | 45% / 65% / 49% | — | 1037 / 1118 / 773 |
| apple 100/101/102 | 53% / 66% / 74% | 79 / 824 / 191 | 891 / 1394 / 801 |
| vinegar 100/101/102 | 38% / 38% / 36% | 138 / 93 / 92 | 555 / 807 / 368 |
| combined 100/101/102 | 39% / 41% / 38% | fruit 82/152/106, vinegar 171/181/181 | 380 / 736 / 474 |
| combined-exit-adjacent | 48% / 66% / 62% | fruit 203/140/102, vinegar 1529/899/0 | 926 / 1529 / 335 |

Room-2 share (the eastern detour) is 21–27% empty, 14–25% under `apple`, and 3–8% under
`combined-exit-adjacent`.

Feeding never occurred: 0 feeding ticks and 0 feeding bouts across all 15 attempts, with
fruit placed in 9 of them.

## Is the attractor a trap or route help?

Both, depending on where it sits, and it is never a *feeding* trap in this regime.

- **Not a feeding trap.** No fly ever fed. Under the timed policy the fruit acts purely as
  an attractive-odour source (radius 0.75, rate 1.0); its edibility never engaged.
- **At (1.6, 2.3) it is a distraction/anchor.** It is 1.6 m from the exit, well outside its
  own 0.75 m plume radius, so its gradient peaks 1.6 m short of the window. It does hold
  flies in the exit room (room-1 share up in all three seeds) but it holds them *at the
  fruit*: seed 101 shows 824 dwell fly-ticks, escapes 10 → 9, and median escape tick
  1118 → 1394. That is the signature of a holding spot, not route help.
- **At (0.35, 2.25) it reads as route help.** Its plume covers the whole opening, dwell
  falls to 102–203 fly-ticks, median minimum distance to the exit midpoint tightens to
  0.44–0.46 m in every seed, and the worst empty seed (100: 5) rises to 11.

## Repellent

Vinegar at the prior (4.2, 2.35) is **harmful on average** (−1.00; −4 on seed 101). It sits
0.75 m from the spawn box, and the room shares show it evicting flies from the exit room
(45/65/49% → 38/38/36%) and pushing them north into rooms 3/4 rather than west toward the
window. Moved beyond the eastern doorway into room 2 at (5.4, 2.55), it suppresses the east
detour hard (room-2 share 21–27% → 3–8%) without polluting the spawn neighbourhood. One
side effect worth noting: flies that do enter room 2 accumulate large dwell right at the
repellent boundary (1529 and 899 fly-ticks on seeds 100/101), i.e. they hover against it
rather than turning away cleanly.

## Cost and errors

15 complete attempts (budget was 15), 1347 s of native simulation wall time, 58–148 s per
attempt, run strictly serially. Zero simulation errors and zero rejected plans among the
five plans run. Two harness build errors during authoring (a private `Point::distance`),
fixed before any attempt; no attempt was discarded or re-run, and no result was excluded.

## Limitations

Three seeds. Seed-to-seed variance of the empty control alone is 5–10 escapes, which is
larger than every arm difference except `combined-exit-adjacent` on seed 100. With n = 3
no arm difference here is statistically supported; the per-seed diff columns matter more
than the means. `combined-exit-adjacent` moved two objects at once relative to `combined`,
so its +2.00 is not attributed between the exit-adjacent attractor and the relocated
repellent. Its whole advantage comes from one seed (100: 5 → 11); on seeds 101 and 102 it
is exactly neutral. This is a first-level, single-level pilot on `open-window` only, with
no fan arm and no held-out seed set. **No claim is made that the level is balanced or that
any arm is generally reliable.**

## Most promising next calibration action

Disentangle `combined-exit-adjacent` by running the two halves separately —
fruit (0.35, 2.25) alone and vinegar (5.4, 2.55) alone, each paired against empty — over a
larger seed set (≥ 10 seeds, ideally the frozen 30-seed tuning set through
`campaign_probe`). The exit-adjacent attractor is the stronger hypothesis: it is the only
change that tightened median minimum exit distance in every seed while cutting dwell, and
it is the cheaper of the two to justify to a player. Secondary: sweep attractor distance
from the exit (0.35 / 0.75 / 1.6 m) to locate where an attractor stops being route help and
becomes an anchor, since that boundary is what the whole placement mechanic trades on.
