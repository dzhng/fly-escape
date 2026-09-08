# Controlled feeding benefit

The current actual graph still drives a meal that replenishes reserve and extends
life through native mesh contact. This accepts the controlled flat-food mechanism,
not slice 20's curved-fruit integration or campaign food seeking.

The existing lifecycle fixture supplies seed 6, taste gain 1, a 1.5 m flat food
patch, its existing wind and compressed energy costs. The paired control changes
only feeding rate from 3 to zero (plus the administrative attempt label). Food,
contact, odor fields, taste settings, graph, motor mapping and noise streams stay
identical. Both arms use the production AttemptClient Worker, WASM Attempt and
packed FrameArchive decoder in Chrome. No warmup, controller or food expansion
was added. Twenty fixed starting states repeat the fixture's original pose;
normal fly-ID stream derivation gives each brain independent noise. This is a
controlled meal opportunity, not a swarm's navigation through a furnished house.

Fly 0 starts feeding at tick 56 with proboscis spike fraction 0.25 above its 0.2
threshold. Its support remains the floor (`null`); the native hull touches the
coplanar edible patch through the same `food_at` mesh query used for fruit. Both arms leave contact at tick 70. The
enabled arm gains 3.74896 reserve and starves at tick 173; the disabled arm gains
zero and starves at 111. The older evidence's tick 108 control silenced proboscis
neurons, which is a different intervention.

Seven of twenty flies feed. All seven gain reserve and live 41–79 ticks longer;
the remaining thirteen do not feed and have unchanged lifetimes. The population
median benefit is zero. Neural output, sensory samples and input poses are equal
while both members of each pair remain active. The full packed-decoded frames and
inputs are retained, so this conclusion does not depend on rounded UI counters.

Run `tests/browser/feeding-benefit.mjs` against a Vite server with the current WASM
build and real graph assets. `BRAIN_URL`, `FLY_COUNT=20` and `FEEDING_OUTPUT` select
the server, bounded population and output directory. The harness obtains the
fixture from the existing BrainClient lifecycle owner, then runs the matched
production clients. `browser.json.gz` retains the browser version, build/graph
identities, exact input and frames; `summary.json` retains per-fly checks.

No physics correction was required. The next acceptance question remains actual
curved fruit contact and a meaningful meal opportunity in authored content; this
flat-patch result cannot substitute for it.
