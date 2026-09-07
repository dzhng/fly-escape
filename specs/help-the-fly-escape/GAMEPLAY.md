# Game and player experience

## User requirements

The shipped game runs locally in a desktop browser and contains two carefully designed authored levels of increasing size and difficulty. Every level has 20 flies. Level 1 has five rooms and teaches through its layout; there is no separate tutorial. Dead ends are intentional choices, not malformed rooms. Structure the simulation for up to 100 flies later without making that optimization an MVP gate.

The player shapes the environment before releasing the flies. Each level supplies a fixed inventory, without money or a shop. Attempts use fresh random seeds; replay preserves the same attempt. One star unlocks the next level; higher stars reward more escaped flies. Eating extends a finite life reserve and must matter on larger maps. Only flies that physically escape count toward the score.

The world is fully 3D, with a fixed angled camera, RTS scrolling and zoom. Whole-house framing is the most zoomed-out view. Clicking a model or its right-hand card enters close follow; further zoom keeps the camera following. White fading trails help the player track small flies. Pointer selection needs only a yellow circle, as clarified by the [rejected focus indicator](assets/ui/rejected-focus-indicator.png).

Every fly has a card in the scrollable right panel, containing both a grouped neural diagram and time traces. Selection scrolls to its card. Plain language is primary; detailed tooltips explain neuroscience for a reader with no background. The [approved mock evidence](assets/ui/mock-review.md) establishes the visual direction and interaction intent; its SVG world is not the production renderer.

## Defaults selected by the planner

These fill ordinary implementation gaps; they are not quoted user answers. Pre-run placement allows choosing, moving, rotating directional tools, and removing items with immediate inventory refunds. Freeze placements during simulation/playback. Retry preserves the setup as editable defaults but creates a fresh seed on the next Run. Start, buffering, playing, paused, complete and error are explicit states. Cancelling returns to editable placement. Replay and seeking never award progress twice.

Place tools on open floor, outside solid props/walls, the spawn footprint and the exit opening; keep placement centres separate while allowing sensory fields to overlap. Invalid placement gives a specific visible reason and does not consume inventory. A fan's arrow shows its direction. The placement preview and simulation share field and geometry owners. No mandatory introductory modal or tutorial checklist.

Tool vocabulary: food fruit (odor plus edible landing surface), scent crumbs (odor without food), vinegar (repellent mapping), lamp/shade (measured visual cues), fan (wind), and threat cue. Levels introduce only tools whose graph-mediated effect passed the field/ablation probes. Fixed zappers are optional hazards, at most one per level, never at spawn or covering the only exit opening. Do not use hazard randomness to fake difficulty.

All placement tuning, exact layouts, tool counts, time budgets and star numbers are delegated to the implementing agent **within the campaign acceptance criteria below**. Do not quietly substitute a weaker simulation if a puzzle is unwinnable; first adjust geometry, inventory and sensory tuning within documented interfaces.

Progress uses localStorage: best stars per level, preferences and last editable placements. Unlocks derive from best stars. Store completed results once per attempt; failures to persist do not destroy the current playable session. No accounts, migration, cross-device saves or persistent replay library. Reset progress is an explicit player action. Reloading ends an unfinished attempt.

## A natural starting swarm

Each attempt starts twenty flies in the same authored general area, with randomized individual positions and headings spanning all directions. Some begin walking and some begin flying. They should read as a loose swarm rather than a formation or a line all facing the exit. Interpret the user's “waking” as walking alongside flying.

Randomness is derived from the attempt seed, so replay and paired experiments preserve the exact starting swarm. Initialization does not add a continuing random steering controller: subsequent motion still comes from the established neural/body simulation. Spawn states must be physically valid, clear blocking furniture and walls, and remain inside the authored spawn area. Tool placement reserves that whole area rather than only a few sample starting points. Fixed initial states remain useful for explicitly controlled scientific diagnostic fixtures, not for campaign starts.

## Visual target: a warm, lived-in house

The user explicitly requests photorealistic rooms and selected a warm, lived-in house. Final presentation needs realistic natural colors and materials, daylight and household lighting, furniture, plants, and recognizable three-dimensional food such as apples and bananas. Empty blue-grey rooms, generic block furniture and nearly flat source markers are intermediate foundations, not the final art target.

Establish the look in one furnished room using Blender-authored assets and the actual browser renderer before expanding it through the campaign. Judge realism at the default close/follow camera and further zoom, as well as room readability at Overview. Keep the selected fly, its yellow ring and white trail readable; do not regain contrast by stripping rooms of their real colors and furnishings.

Furniture that occupies traversable floor must agree with authoritative collision and sensory geometry. Wall-mounted decoration and background detail must not create false solid passageways. Proper food models require a coherent visible contact surface and feeding presentation; the earlier near-flush food contract must be revisited rather than stretching a flat marker into an apple. Preserve graph-driven behavior and the browser-only runtime while resolving these seams explicitly. Any geometry or sensory changes invalidate the affected level's final validation; retain prior bare-room evaluations as calibration evidence.

## Two authored levels

The user reduced the campaign from five levels to **two**, prioritizing level quality. Level 1 still has five rooms and teaches through play without a separate tutorial. Level 2 must be larger and introduce meaningful decisions, with eating materially extending a fly's ability to complete the route. Exact second-level room count, layout, names and inventory are delegated; the prepared six-room turning layout is a starting point, not an accepted puzzle.

Both levels use the warm, lived-in furnished visual target above. Finish and playtest these two levels rather than adding breadth through more campaign entries. One star on the first unlocks the second; higher stars reward additional escapes.

Each layout is connected from spawn to exit, has legal placement surfaces and a reachable exit opening. A room may have one doorway; doors are bidirectional passage openings, not mandatory entry/exit pairs. Use a topology diagram and a greybox run to inspect each layout before decoration. Later levels must grow in room count and decision complexity, not merely shrink time limits.

For each level publish a reference placement and a deliberately poor but legal placement. Evaluate both using the same 30 root seeds, 20 flies each; hold another 30 seeds out for final validation. Record distributions, star rates and paired escape differences, not a cherry-picked run. Reference placement should earn ≥1 star in at least 27/30 attempts and improve median escapes by ≥4/20 over the poor placement. Initial targets are planner gates; if they prove mismatched to the neural model, revise the spec with evidence rather than silently lowering the bar. Freeze all three increasing star thresholds before holdout evaluation. No threshold may be zero.

For level 2, compare the same reference with its food replenishment disabled while odor remains unchanged: median escapes must fall and starvation must rise. This isolates eating from attraction. Confirm a representative fly can eat, leave, and eventually need food again. Difficulty also needs a human route/inventory review—statistics alone do not establish fun.

## Science panel and honest explanations

Render all 20 cards in a scrollable panel, keeping each card's grouped network and trace visible together when the card is in view. Off-screen plots may pause drawing; their sampled data remains available. Do not replace all-card information with a selected-fly-only inspector. Label fly number, mode, reserve, terminal state and currently visible simulation time.

Use friendly headings such as “Smell”, “Turning”, “Taking off” and “Eating”; let tooltips reveal anatomy and computation. Descriptions and detailed tooltips teach how neurons work, not game mechanics or puzzle strategy. Explain signal integration, spikes, synapses, excitation/inhibition and the relevant circuit in accessible language; keep instructions for controls and tools separate. Each tooltip answers: what this means in plain language, what the simulation measures, which data/pathway it uses, and what is approximated. Distinguish “average electrical state” from “fraction firing this tick”; do not call a voltage trace firing rate. Group links indicate the model's grouped connectivity, not a live animation of every synapse. Explain that the structural connectome is real data, while neural dynamics, sensory injection, movement decoding and energy rules are models.

Tooltip wording requires source review; old spike prose is not proof. Show detailed tooltips on hover and keyboard focus, keep them within the viewport, and allow sufficient time to read them. Colors need labels, terminal flies stay in their original card positions, and selection should not reorder the roster.

## Visual references and limits

Use `assets/ui/` for approved framing/panel examples and the explicit negative selection reference. The source fragment is preserved at [ui-mock.fragment.html](visualizations/ui-mock.fragment.html); it expects the conversation visualization host and is evidence, not a standalone game or build dependency. The original whole-house image sets a zoom limit, not the default shot. These older stylized images establish framing and interaction only. Final art follows the warm, lived-in photorealistic house target above.

Deferred: camera rotation, mobile layout, procedural levels, accounts, shop/currency, full-neuron inspection, persistent replay sharing, GPU neural compute, multiplayer, and 100-fly performance optimization. Actual 3D assets and food extending life are not deferred.

At wide zoom, enlarge the 3D fly models dynamically so players can still see and select them. Return to native size at close zoom. The user explicitly prefers readability over exact visual proportions in Overview; this affects display size, not simulation physics.
