# Bounded spike: three-ray geometric proximity as neural sensory input

Worktree: /private/tmp/fly-sparse-neural-delivery (branch codex/sparse-neural-delivery)
Scratch dir: /tmp/geometry-vision-spike — spike.patch, proximity_spike.rs, results.json, raw-run.txt
No commits, no edits outside this worktree.

## Recommendation: DEFER

The rays work and feed real neural input, but they do not reduce collisions. Across 10
paired seeds the proximity arm spent MORE time pressed against geometry in 10/10 seeds
(+0.055 contact rate), while escapes (+0.2, sd 1.32, 4/10 wins) and progress
(+0.19 m, sd 1.23, 5/10 wins) were a wash. Nothing here justifies carrying the input
into the campaign.

## Feasibility checks (all passed before implementing)

- Existing sensory groups: `visionL` / `visionR` exist in the graph manifest
  (crates/sim/src/sensory.rs:43, crates/sim/tests/attempt.rs:12). No new groups needed.
- Motor exclusion is already enforced for any group input by `group_currents` ->
  `motor_readout_indices` (crates/sim/src/sensory.rs). The proximity path reuses it
  verbatim, so proximity current cannot reach a DN/MN readout directly.
- Geometry owner: `BodyWorld` already owns both blocking geometry and native surfaces
  (crates/sim/src/body.rs:221-224). Rays were added there, not in a new owner.
- Existing Parry queries: `ContactScene::below` (crates/sim/src/surface.rs) is already a
  normalized-unit `Ray` + `cast_local_ray_and_get_normal` against the same TriMeshes.
  `Geometry::sweep` / `motion_contact` (crates/sim/src/environment/mod.rs:119,141) are
  already segment-vs-box casts against walls and solids.

## What was implemented (scratch only)

- `ContactScene::along` (crates/sim/src/surface.rs): `below` generalized to an arbitrary
  direction. Same QUERY_UNITS normalization, same `checked_hit`, no new dependency.
- `BodyWorld::proximity` (crates/sim/src/body.rs): three body-frame rays at
  heading + {0, +0.6, -0.6} rad, 0.25 m reach. Each ray takes the nearer of
  `Geometry::sweep` (rooms/walls/solids) and `ContactScene::along` (native object
  surfaces, sampled at y = 0.01 m). Returns normalized proximity 0..1 per ray.
- `sensory::proximity_currents`: ipsilateral encoding into the existing pair —
  visionL = gain*(left + 0.5*forward), visionR = gain*(right + 0.5*forward) — routed
  through `group_currents`. No contralateral turn rule, no steering, no motor injection,
  no avoidance fallback. Whatever the graph does with it is the graph's result.
- `AttemptTuning.proximity_gain` / `.proximity_reach` (serde default 0 = disabled), read
  once per tick in `Attempt::advance_tick` alongside the existing cue currents.

## Fixture and results

One 6 x 3 m room, exit slot at x = 6, two offset solid boxes forcing a zigzag route;
6 flies, 900 ticks, InhibitoryOdor cue at gain 1 in both arms, identical seeds and
level per pair. Only `proximity_gain` differs (0.0 vs 1.0).

Commands:
    cargo build -p sim --release --example proximity_spike
    ./target/release/examples/proximity_spike \
      /Users/david/dev/fly-escape/data/processed/brain 10 6 900 \
      /tmp/geometry-vision-spike/results.json

| metric | disabled | proximity | paired delta |
|---|---|---|---|
| escaped (of 60) | 11 | 13 | +0.20/seed, sd 1.32, 4/10 wins |
| contact rate | 0.678 +- 0.053 | 0.733 +- 0.071 | +0.0549, sd 0.061, 10/10 WORSE |
| stall rate | 0.125 +- 0.037 | 0.120 +- 0.054 | -0.0044, sd 0.065, 5/10 |
| progress to exit (m) | 3.020 +- 0.640 | 3.213 +- 0.919 | +0.193, sd 1.23, 5/10 |

Contact rate = fraction of live ticks where the body sits inside the conservative
blocking footprint at a 5 mm margin (`Geometry::contains_body`) — pressed against
geometry, i.e. the collision/blocked-movement signal, not ray hits.
Stall rate = fraction of live ticks with displacement under 10% of nominal walk step.
Progress = per-fly (start distance to exit - closest approach), averaged.

## Limitations (precise)

1. **Modeled proximity is not rendered fly vision.** These are geometric distance rays
   with no optics, no ommatidial sampling, no luminance, no motion energy. Calling the
   channel `visionL/visionR` reuses an existing lateral pair; it does not make this sight.
2. **Metric confound:** escaping flies stop accruing live ticks, so contact rate is not
   fully independent of escape count. The 10/10 consistency of the increase survives
   this, but the effect size does not.
3. **n = 10 paired seeds, 6 flies.** Escape and progress deltas are far inside their own
   standard deviations. This can detect "obviously helps"; it cannot resolve a small win.
4. **Rays are planar.** They ignore the fly's height and the solids' 0.5 m height, so a
   flying fly clearing a box still reads it as blocking.
5. **Object rays sample one fixed height (y = 0.01 m)** rather than the body's actual
   height, so low or elevated native surfaces are hit or missed inconsistently.
6. **Encoding untested beyond one variant.** One approach only, per the brief: ipsilateral,
   0.6 rad spread, 0.25 m reach, gain 1. A contralateral or wider-spread encoding was not
   tried and remains unmeasured — but trying more is a tuning sweep, not this spike.
7. The wall/box fixture is not campaign content and shares nothing with open-window.ts.

## If revisited

The single actionable signal is that the ipsilateral encoding raised wall contact in
every seed — the graph appears to be driven toward, not away from, the obstacle. Any
follow-up should first test the opposite (contralateral) binding on the same fixture
before spending anything on more seeds. That is a decoder/binding question, which this
spike was explicitly scoped out of.
