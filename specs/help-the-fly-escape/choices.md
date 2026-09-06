# Implementation choices

## Sound — medium confidence

### Injected noise is already scaled (slice 01)

When a reference tick contains a noise value, the Rust port must add that value directly to its voltage equation. Multiplying it by the noise setting again would make the same test represent a different input. The plan required injected noise but did not specify its representation. This choice makes the fixture portable and constrains the future test reader, not production random-number generation.

### Tiny-fixture float tolerance is 1e-12 (slice 01)

Python and Rust can round an arithmetic operation slightly differently. The four-neuron reference therefore accepts absolute or relative differences up to 1e-12 for floating values, while spikes and countdowns must match exactly. The plan required stated tolerances without selecting them. This tight numerical check is sound for these small fixtures; it is not a claim that large noisy simulations remain identical forever.

### One-fly transport uses generated JSON before packed swarm records (slice 02)

The lab requests one neural tick and receives a small JSON frame whose type comes from Rust. This makes the first real browser checkpoint inspectable without inventing the whole swarm archive at once. The plan did not specify the intermediate transport encoding. It is a temporary, bounded one-fly seam; slice 05 replaces its per-tick JSON transfer with packed chunk buffers while retaining the same authoritative simulation and playback data.

### Lab movement is a bounded observation fixture (slice 02)

The first fly moves on a twelve-unit square from its neural thrust and turn. A wall stops penetration without choosing a new direction. This gives us an observable brain before sensory fields and body mechanics are ready; it is not a substitute for the final locomotion model. The plan requested a chamber without fixing its movement scale. The dimensions are exported by the core, and slice 03 replaces the chamber-only geometry path with the general environment owner.

### Browser smoke tests use installed Chrome (slice 02)

The browser checks launch the locally installed Chrome through Playwright, so the evidence names an actual desktop browser. Playwright's newly installed default Chromium binary was absent. The test exposes a browser-channel setting rather than silently downloading a different browser or calling the missing executable a passed test. Firefox/Safari release coverage is still required later.

## Sound — high confidence

### Read intermediate values from the running Python oracle (slice 01)

The fixture generator observes local values when the real `step` function returns. It records the currents and voltage increments that function actually calculated, rather than maintaining a second copy of its equations. The plan required a trustworthy oracle but left observation mechanics open. Regeneration depends on those Python variable names; the saved fixture and future Rust tests do not.

### Assign synthetic motor groups directly (slice 01)

A test neuron may belong to two motor groups so the fixture can detect incorrect averaging. These memberships are explicit test inputs, not claims about fly anatomy. The plan did not prescribe how a miniature graph would obtain memberships. Separating arithmetic tests from real annotation extraction lets both fail for useful, distinct reasons.

## Sound — medium confidence (sensory/body integration)

### Stimulation excludes neurons read directly as movement (slice 03)

When a smell population overlaps a neuron whose voltage directly controls movement, the sensory adapter leaves that neuron unstimulated. The signal must reach the movement readout through the network. The plan required graph-driven behavior but did not define overlap handling. This avoids mistaking a direct motor injection for a circuit response; future sensory mappings inherit the same exclusion. Paired probes show the downstream response persists.

### Body actions begin with spikes and can last between spikes (slice 04)

A fly touching food starts a meal when enough proboscis motor neurons emit a spike. It then keeps eating during brief gaps between spikes, until contact, fullness or the bout limit ends the meal. The plan required neural initiation but left the signal decoder unspecified. A voltage threshold was nearly always active and could not distinguish initiation. Spike initiation preserves a neural cause without requiring every cell to fire continuously; silencing those neurons prevents every tested meal. Landing similarly enforces a short grounded interval before takeoff is possible again.

### An attempt error ends that attempt (shared Attempt preparation)

If advancing one fly fails after another fly has already advanced, retrying the tick would give them different histories. The Attempt owner remembers the failure and returns it on subsequent calls; the user can start a fresh attempt. The plan did not define partial-tick recovery. This keeps errors explicit without copying every brain on every tick for rollback. Future transport must present the error and must not retry the same attempt silently.

## Sound — high confidence (sensory/body integration)

### Replay identity includes the whole simulation source tree (shared Attempt preparation)

A saved attempt carries a build identity computed from simulation source, dependencies and compiler/target information. Adding a new Rust module changes that identity even if someone forgets to list it manually. The plan required reproducible identities but left build fingerprinting mechanics unspecified. Future replay can reject a different simulation instead of presenting different results as the same run.

### Field overlays show the actual sampled grid (slice 03)

When a fly senses odor in a grid cell, the colored floor comes from that same cell value exported by Rust. JavaScript does not draw a separate smooth approximation. The plan required agreement but left interpolation unspecified. This makes abrupt cell boundaries honest and lets numeric antenna samples explain what the brain actually received; future visual smoothing must not change the simulation.

## Sound — medium confidence (lifecycle and records)

### A selected seed demonstrates the full lifecycle (slice 04)

The lifecycle lab opens a seed that actually lands, starts eating through neural spikes, leaves food and later starves. A bounded ten-seed check found one such demonstration; the screen says that the seed was selected. The plan required a short review surface without prescribing how to ensure the sequence is visible. This is a reproducible example, not a claim that a typical fly finds food. Population feeding and campaign robustness still require their own tests.

### Eight event slots bound each fly’s tick (slice 05 preparation)

A fly can land, begin and end a meal, and reach a terminal outcome during the same tick. The compact record budgets eight events per fly per tick, above the six-transition combination exercised by the current body. If a future behavior exceeds that count, encoding fails explicitly until the bound is reconsidered. The plan required memory to include events but left their maximum representation open. This keeps the archive estimate honest without allocating unbounded event history.

## Sound — high confidence (records)

### Replay retains the original numeric precision and absent samples (slice 05 preparation)

A recorded neural voltage stays a 64-bit floating-point value, rather than being rounded for transfer. Once a fly is terminal, its absent neural/sensory samples remain absent through explicit presence flags; zeros would falsely look like measured inactivity. The plan required consistent replay without choosing the numeric encoding. The complete 20-fly horizon fits the archive limit with this precision, so compression does not need to change the observations.


## Sound — high confidence (browser transport)

### Archive acceptance transfers ownership (slice 05 transport)

When the Worker delivers a record, the archive takes its buffers and detaches the caller’s references. Code handling the incoming message can no longer accidentally change an old voltage or pose after it was accepted. The plan required immutable replay but left the ownership mechanism open. This avoids copying the full history while making future consumers treat incoming records as consumed after append.

### Transport generations are separate from attempt identity (slice 05 transport)

If a caller restarts an attempt using the same ID, an old message can still be waiting in the browser’s queue. Each start now receives a fresh local generation number, and only messages carrying that number reach the consumer. The plan required stale-message rejection without specifying how to handle reused IDs. This preserves deterministic attempt identity while preventing an old error, record or credit from affecting the new run; callers need not retain an ever-growing set of forbidden IDs.

### Native and browser performance use one diagnostic level (slice 05 transport)

The browser asks Rust for the same closed-room fixture used by the native benchmark. Its flies remain alive and active for the full horizon, so timing cannot look fast merely because flies stopped running their brains early. The plan required comparable active-work measurements without choosing the fixture’s owner. This keeps geometry and tuning in the simulation; the diagnostic helper is not campaign content.


## Sound — medium confidence (playback diagnostics)

### Recent slowdowns influence the buffer estimate (slice 05 UI)

When production slows after playback begins, the client compares its whole-run speed with the last twenty chunks and uses the slower estimate before applying the clock’s safety margin. The plan delegated buffering safety but did not specify a measurement window. This can cause extra waiting after a slow start, but avoids assuming an early fast sample will last forever. The window remains subject to the sustained browser measurements.

### Placeholder flies share mesh resources (slice 05 UI)

Twenty placeholder flies reuse their geometry and materials while keeping separate positions. This avoids making twenty copies of GPU resources without introducing an instanced rendering path before measurement. The plan left batching open. The initial desktop frame measurements fit the target, but real assets and the 100-fly capacity probe still need profiling before keeping this approach for release.

## Sound — high confidence (playback diagnostics)

### Timing history has fixed memory (slice 05 UI)

Each rendered frame contributes to a small histogram instead of an ever-growing list of timestamps. Durations above one second share an overflow bucket; the report flags a percentile that reaches that bucket and retains the exact maximum. The plan required bounded memory without specifying timing storage. This keeps the benchmark itself from accumulating a large history while clearly disclosing the precision limit.

### Detailed GPU accounting runs only on request (slice 05 diagnostics)

Downloading a report estimates buffers, textures and render targets owned by the scene. Regular frame statistics remain cheap counts. The plan required memory evidence without specifying when to collect it; scanning all scene resources repeatedly would distort the performance being measured. Browser and driver overhead remain explicitly outside this estimate.

## Sound — medium confidence (camera preparation)

### Startup follows the first fly (slice 06)

The playback view initially follows fly 1 at close distance. The user required a close default view and selection-driven follow but did not name an initial selection. Using the first roster entry makes that state explicit; Overview and another selection remain one click away. This provisional startup choice can change when the setup-to-run transition is integrated.

### Cutaway hides only walls on the viewing ray (slice 06)

The camera hides visual wall segments between itself and the followed fly's center. Collision remains unchanged. The plan allowed cutaway without choosing its method. A center ray is simple and bounded, but final room geometry must verify that a visible center also leaves enough of the fly unobscured.

## Sound — medium confidence (model replacement)

### Invalid asset origins are reported instead of silently corrected (slice 07)

The loader requires finite three-dimensional bounds, a footprint containing the origin, and ground height within five percent of model height. The plan specified ground contact and declared scale but left numerical tolerance open. This catches exports that would disappear from follow framing, while tolerating tiny floating-point export errors; the workbench does not resize or recenter a malformed replacement on the user's behalf.

## Sound — high confidence (model ownership)

### The view owns each accepted model (slice 07)

A successful replacement transfers the model to the renderer. Fly instances share geometry and materials, while skeletons remain independently poseable. A superseded load disposes its candidate instead of replacing the current scene. The plan required disposal but left lifetime ownership open. One owner makes replacement and teardown release the same resource sets, including skeleton textures.

## Sound — medium confidence (recorded motion)

### Landing is a short transition before walking (slice 08)

When a recorded fly switches from flying to walking, its model plays the authored landing clip before the walking loop. Feeding takes precedence if that is the recorded mode. The plan required the four clips but did not prescribe how to identify a landing without adding a new body state. This interpretation changes only visible pose; it cannot move the fly or decide whether it lands. Replacing the landing clip requires keeping its duration and the transition policy consistent.

## Sound — high confidence (recorded motion)

### Motion phases are reconstructed from packed records (slice 08)

When playback advances, the archive remembers the latest mode change and terminal tick for each fly. Seeking backwards rebuilds those few values from the bounded packed history. The plan required repeatable animation without specifying retained transition state. This adds at most 800 bytes for 100 flies, rather than another decoded history. The renderer samples each clip at an absolute time, so pause and reverse seek return the same pose without changing simulation state.

## Sound — medium confidence (science panel)

### Each fly shows one selected group's two traces (slice 13)

A player can see voltage and firing fraction together, then choose any other neuron group on that fly's card. All group activity nodes remain in the diagram. The user requested both views on every card but did not specify whether every group's history must be drawn simultaneously. Drawing every trace at once made the narrow card hard to read. This provisional density choice preserves access to every group and can be reversed without changing recordings.

### Connectivity follows the selected group (slice 13)

Choosing a group also reveals its incoming and outgoing connections. The panel uses the exported wiring and says explicitly that these are the selected group's links. The plan left diagram density unspecified; drawing the complete mesh obscured its arrows and labels. This makes direction readable while retaining all group nodes, but the player must change selections to inspect the full network.

### Voltage axes follow visible values (slice 13)

When a voltage exceeds the initial plot range, the plot expands and prints its current bounds. Firing fraction always uses zero to one hundred percent. The plan left axis policy open. This keeps voltage changes visible, but comparing cards requires reading their scales; the model units are not biological millivolts.

### Explanations sit beside the panel when space permits (slice 13)

On desktop, opening an explanation leaves its source card visible alongside it. Narrow windows use a bounded, scrollable overlay that covers the card until closed. The user asked for detailed tooltips without specifying small-window layout. This is a reversible presentation tradeoff, with keyboard and pointer access preserved.

## Sound — high confidence (science panel)

### History work is bounded to nearby cards (slice 13)

Every fly keeps a card, but only cards near the visible part of the scroll panel read up to ten seconds of packed history for plotting. Scrolling or seeking rereads the original records; it does not delete older data or invent zeros for absent measurements. The plan required bounded work without choosing the displayed history window. This limits rendering cost while preserving replay accuracy.

### Circuit labels are explicitly candidate interpretations (slice 13)

A tooltip explains neuronal signaling and identifies which source-selected group it summarizes. It distinguishes biological research from assumptions in the simulation, because an inherited group name does not independently establish the anatomy of its chosen cells. The plan requested scientific explanation but left provenance wording open. Future annotations can improve those interpretations without misrepresenting today's model as a recording of living-fly activity.

## Sound — medium confidence (airborne selection)

### The selection circle follows the fly's height (slice 06 integration)

When the selected fly takes off, its yellow circle now rises with its displayed body. Keeping it on the floor made the circle appear around neighboring flies in the angled view. The user asked for a yellow circle without specifying its altitude; the initial plan chose ground placement. This reversible correction keeps the same single ornament and perspective while making selection clear. It changes no physical position or collision.

## Sound — medium confidence (mixed sensory preparation, slice 14)

### Treat the nearby exit signal as part of the attractive odor input

When a fly samples the room-local exit cue, that value joins the attractive odor concentration before left/right contrast selects the inhibitory-labeled sensory population. Repellent sources have their own concentration and drive the excitatory-labeled population. The plan required independent attractive/repellent inputs but did not place the existing exit signal between them. Keeping it with the attraction candidate preserves the measured exit diagnostic and avoids a new unmeasured input pathway. This is a model binding, not a claim that real flies sense exits as smells. It constrains future exit cue calibration. Verdict: sound; confidence: medium.

## Sound — high confidence (mixed sensory preparation, slice 14)

### Enable each odor or vision pathway at most once

An attempt carries a small list of enabled sensory pathways and their gains. If attraction, avoidance and light are all enabled, their currents add before each neuron updates. Leaving one pathway out disables that input for a comparison; repeated entries are rejected rather than quietly doubling the stimulus. The plan required simultaneous input without choosing its representation. A maximum of three unique entries covers the actual channels and bounds work without an unrestricted routing graph. Taste remains separately controlled by physical contact. Verdict: sound; confidence: high.

### Share transport geometry and scratch storage between odor channels

Attractive and repellent sources diffuse and move with wind independently, but use the same floor cells, wall connections and transport coefficients. The solver reuses one temporary array after finishing each channel, and counts both channels against its work limit. The plan required shared transport without choosing memory ownership. This avoids duplicate geometry and a second algorithm while ensuring one scent never changes the other's concentration. Different chemical diffusion rates would require an explicit future model change. Verdict: sound; confidence: high.


## Sound — medium confidence (local fan preparation, slice 14)

### A fan produces a bounded, wall-occluded rectangular jet

When a fly is in front of a fan, it samples a wind vector that fades with forward and sideways distance; behind the fan, beyond its reach or behind a wall, that fan contributes nothing. Several fans add their vectors. The plan required placed directional wind but did not choose its shape. A rectangular footprint with linear falloff is simple to show in placement previews and uses existing line-of-sight geometry, without claiming to solve air turbulence. Odor moves using face averages of the same cell vectors that push the bodies. Fan reach, width and speed remain calibration choices for authored levels. Verdict: sound; confidence: medium.


## Sound — medium confidence (placement preparation, slice 14)

### Keep each tool footprint inside one room

When a player places a tool near a doorway or floor edge, its conservative square footprint must fit within one room rectangle and clear walls. A tool cannot straddle a room seam even when an unusually wide opening would physically allow it; its sensory field can still cross the doorway. The plan required open-floor placement without choosing boundary clearance. This conservative rule keeps the first placement interface predictable and avoids visually clipped tools. It can be relaxed later using a general union-of-floor footprint test if authored layouts need seam placement. Reserved circles mark solid prop interiors or extra protected floor; spawn body circles and the exit are always protected. Verdict: sound; confidence: medium.

## Sound — high confidence (placement preparation, slice 14)

### One tool catalog supplies effects across levels

Fruit always resolves through the same catalog entry into an attractive odor source and a separate edible contact region; crumbs use the odor source without food. The level chooses quantities, while the core catalog owns footprints, source dimensions and fan dimensions. The plan delegated tuning but did not choose where it lives. Shared definitions let palette information and simulation resolve the same object, and prevent a fruit silently changing properties between rooms or levels. Inventories are bounded at 64 total tools across the available types, keeping edit validation and source counts bounded for the MVP. Current values remain provisional until campaign evaluation. Verdict: sound; confidence: high.

### Derive inventory from a validated replacement setup

Placing, moving or removing a tool first builds a candidate list. Core validation then derives remaining counts from that list and the level inventory. A rejected move returns an error and no replacement; there is no separately decremented counter to repair. Repeating the same placement or removing an already absent item leaves a valid setup unchanged; reusing an ID for a different placement is rejected. The plan required immediate refunds and no consumption on invalid edits without choosing state ownership. This keeps retries and saved editable setups consistent, and gives the future UI one result to accept atomically. Verdict: sound; confidence: high.

### Put canonical placements in attempt identity and expose resolved inputs separately

Before a run, Rust sorts placements by ID, normalizes headings to a stable value below one full turn and resolves them into field sources, food regions and fan fields. The frozen attempt specification contains these placements; metadata also exposes exactly the resolved setup the attempt uses. The plan required immutable placements but did not specify the representation. Keeping authored level content separate prevents retry from accidentally resolving placed sources a second time, while recorded metadata makes the runtime environment inspectable. IDs determine source accumulation order for exact repeatability. Verdict: sound; confidence: high.
## Slice 10 — bounded house renderer checkpoint

### Sound · medium confidence — local house replacement keeps native kit bounds

When an artist uploads a new wall, the workbench accepts it only if its outer bounds and pivot match the authored unit wall. A wall that is wider, taller, off-center or animated is rejected, leaving the previous asset displayed. The plan required scale validation without choosing rejection versus automatic normalization. Rejecting avoids silently stretching a differently authored part into misleading collision space. Future house art inherits this unit-part contract; changing wall height requires deliberately changing the kit contract rather than a local accidental upload. This checks outer bounds, not complete mesh solidity: final authored assets still require the visual/collision consumer gate. The loader also uses the existing fly-scale 20,000-triangle ceiling as a bounded initial part budget; later house profiling may tighten it.

### Sound · high confidence — house inspection is a separate fixture in the existing workbench

Opening the ordinary workbench still shows the fly and its animation controls. Following “Five-room house” reloads that same application with the shared geometry fixture and additional room/door controls. The plan requested a room fixture but did not choose how to expose it. A URL fixture keeps the ordinary workflow stable and makes browser checks reproducible, while both views use the same renderer. Local replacements are intentionally lost when leaving the page, as with the existing fly workflow; source files are never overwritten.

### Sound · high confidence — doorway motion is a geometry-derived diagnostic path

Choosing a doorway and dragging its slider moves the preview fly through the missing wall segment. The workbench finds that opening by comparing the supplied room boundaries with supplied wall coverage; it stores no second layout. The plan asked for a crossing review without specifying a neural recording or manual diagnostic motion. These controls are labeled diagnostic because they establish mesh/collision alignment, not neural success. Future campaign playback must continue to consume recorded poses, and must not reuse these paths as steering.

### Sound · high confidence — solid props remain a separate core contract checkpoint

A chair-shaped obstacle cannot be honestly added today because Geometry exports rooms and wall segments, with no prop footprint. Drawing it would make the fly pass through something that looks solid. The plan names props but leaves their authoritative wire shape unspecified. This checkpoint therefore adds no props and leaves slice 10 open. Its next pass must first add collision/sensory footprints in the core and a consumer fixture, then place authored meshes from that data. This keeps the ongoing performance baseline untouched and avoids baking uncollidable decoration into later levels.

The enclosure follow-up uses the explicitly requested low-base strategy: an occluding wall remains at one tenth of native height, with the same X/Z footprint and shared resources. This height is delegated presentation discretion and reversible without a core change. Each frame restores full height before ray intersection, so yesterday's shortened wall cannot disappear from today's visibility query. The full-height wall returns whenever it no longer obscures a visible selected fly. Overview retains selection: per the updated contract, the same low base may reveal an onscreen selected fly there. Offscreen selections restore walls.


The joined-wall follow-up derives shared noncollinear endpoints from the same Geometry payload and extends only those visual ends by half the kit thickness; lone door ends remain unchanged. This explicitly authorized geometry correction fills the missing corner quadrant without adding a prop, independent layout, or collision change. The selected-visibility policy is also explicit: Overview releases follow but retains selection, and an onscreen selected fly receives the same wall cutaway in every camera mode. Both policies are now in the architecture/spec handoff rather than hidden renderer choices.

## Sound — medium confidence (trail preparation)

### Rebuild a short recorded tail at each playback tick (slice 09)

Each fly's trail uses up to four seconds of recorded positions, with the oldest second reserved for reconstructing a landing's height. Only the last three seconds and two world units are drawn. The user requested fading white trails without choosing storage or duration. Reading packed poses when the playback tick changes keeps seeks faithful without retaining a second full history or letting frame rate change the trail. Width and fade remain reversible visual tuning; the archive supplies motion context and the renderer shares the fly's height rule.

## Slice 14 setup interface — sound

- **Medium confidence — the editor is the home route as well as a lab route.** Opening the app now opens placement; existing lab URLs still open their diagnostic views. The plan requested a runnable setup surface but did not choose the home route. This lets later campaign work replace the fixture content in the actual game entry point instead of creating another editor. The route choice is reversible without altering saved setups.
- **High confidence — hover validation keeps the latest intent rather than a queue.** When the pointer moves quickly, the current core validation finishes and then the newest pointer position is checked; intermediate positions are discarded. A committed click is retained until accepted or rejected. The plan required immediate feedback and bounded work without choosing scheduling. This prevents pointer events from becoming an unbounded Worker backlog while keeping the core the sole placement authority.
- **High confidence — the Worker lives across editor and playback.** Run switches the same client from bounded setup requests to attempt production; Retry cancels that production and returns to editing. The plan required one Worker owner but did not specify component lifetime. Keeping its lifetime outside the shared attempt view avoids reloading the graph on every retry and prevents a second neural owner. Only one request/reply callback handles attempt output at a time.
