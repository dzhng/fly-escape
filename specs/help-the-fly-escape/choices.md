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

The diagnostic floor shows Rust's exported cell-centre field values. Following slice26, antenna readings interpolate up to four visible neighbouring centres, so a floor tile is a grid diagnostic rather than the exact value at every point within it. Walls and solids exclude hidden support. This corrects anatomical-scale aliasing without refining the transport grid; edge reconstruction is one-sided and does not claim continuous visibility at obstacle boundaries. Verdict: sound; confidence: high for numerical reconstruction, pending physical sensory calibration.

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

## Solid footprint preparation

| Choice | Verdict | Confidence | Rationale |
|---|---|---|---|
| Required axis-aligned solid rectangle with presentation height; empty fixtures explicitly opt out | sound | high | Extends the existing planar geometry owner without a second renderer layout or compatibility fallback; parent authorized the seam. |
| All body modes collide with the footprint regardless of mesh height | sound | medium | Existing simulation is planar. Finite-height flight would require a new vertical collision contract; presentation height alone must not quietly enable passage. |
| Unique IDs, positive bounds/height, one-room containment, no wall/interior overlap, max 256 solids | sound | medium | Validates authored topology and bounds construction work alongside existing room/wall limits. Rotated/concave/stacked furniture is outside this checkpoint. |
| One neutral top-beveled block in the pantry, exported from a separate Blender scene | sound | high | Demonstrates a real solid/collider match while preserving every existing doorway and Blender scene; material design remains later scope. |
| Stateless core crossing diagnostic through a coalesced worker | sound | high | Actual core sweep/LOS supplies the visible pose with no handwritten collision or fake neural steering. One in-flight plus latest pending query limits slider work. |
| Apply existing low-base selected visibility to solids | sound | high | Full-height contact screenshot hid the fly. The generic owner-based rule preserves the footprint and collider, restores full height, and fixes the same issue across camera modes. |
| Local mesh replacement validates bounds rather than arbitrary shape solidity | sound | medium | Appropriate bounded developer workbench contract; supplied mesh is explicitly collider-matched. A bounds check is not proof that any imported sculpted object fills its footprint. |

## House palette — superseded by the realistic-art revision

A single sRGB JSON registry owns home surface roles for procedural production geometry, imported house replacements and Blender export. The task requested one palette reaching both routes without choosing the cross-language owner. Imported house meshes retain their geometry but receive canonical role color/roughness, preventing a local shape replacement from silently reverting the home palette. Blender converts that same sRGB input to linear values; a baked/runtime parity test catches stale exports. Food and fly materials remain separate semantic assets.

## Production house loading — sound, high confidence

Load the three house roles as one settled batch per view, then transfer them through the existing replacement owner. The task requested shared authored production assets without choosing partial loading semantics. Waiting for all three prevents a failed kit from leaving a mixed accepted house; every successful sibling is disposed on error or stale view. Temporary primitive geometry remains visible only while explicitly loading and is disposed by replacement. No permanent asset cache or second scene owner is introduced.

## About route — sound, medium confidence

The About surface uses a query on the origin root rather than an additional path, so a basic static file server can serve it without an index fallback. A composition footer links to it after the game, preserving the existing camera viewport and avoiding concurrent setup/playback edits. It is keyboard reachable but below the game; future navigation design can relocate the link without changing attribution content or the serving contract.

## Remaining tool source representation — foundation only, revised by 20–23

The planar non-solid tool contract favors near-flush sources: vinegar saucer, inset fan vent, recessed lamp lens and slatted shade tile. Their geometry identifies catalog sources without adding obstacles or actual scene lights. Shade expresses the measured visual-cue source, not a physical canopy or computed cast shadow. All six tools share placement model ownership; food-only names are retired as the shared static contract expands.

## Natural starts and realistic-room planning — provisional choices

- **Medium confidence:** Start the first candidate with ten walking and ten flying flies, assigned by a seeded shuffle. The user asked for both modes without choosing a ratio. Keep the ratio authored and evaluate whether it reads naturally; no neural behavior changes after initialization.
- **High confidence:** Show only the authored spawn area before Run rather than inventing a preview swarm. The actual attempt exports the starting bodies once; initial rendering and replay share those values.
- **Medium confidence:** Resolve realistic scale in a neutral representative room before detailed furniture and materials. Its room is a diagnostic fixture, not additional campaign content. Exact physical scale remains a measured decision in 19, not an accepted silent change to movement.
- **High confidence:** Keep only explicit fixed-start scientific fixtures alongside clustered campaign starts. Those tests sometimes intentionally overlap bodies or begin at a hazard to isolate behavior; campaign sampling instead enforces a legal separated swarm.

### Sensitivity at physical fly scale (slice 27)

The detector responds to a left/right difference above0.01% of their sum, keeping its existing minimum intensity and sensory-only current strength. The old5% threshold missed the resolved signal across the authored antennae; the intermediate 0.1% candidate also failed. The 0.01% candidate preserves paired odor and light/shade turn responses across 30 seeds and loses them under pathway silencing. This is a deliberate game-model sensitivity choice, not a measured biological threshold. Confidence: medium; final campaign efficacy and three-dimensional sensing remain separate limits.

### Fly visibility at wide zoom (slice28)

User-authorized visual exaggeration uses a common zoom-derived scale with a reversible24 CSS-pixel target span and a native-size floor. Camera projection owns the scale; rendered meshes, yellow ring, follow centre and trail gap consume it. Physics and recorded trajectories retain native dimensions. Confidence: medium; browser readability is improved and close crops unchanged, but compact swarms overlap and final furnishing contrast remains open.

### Curved contact queries (slice29) — sound, medium confidence

Use a collision-query library to constrain proposed movement instead of creating a second physics controller. Parry f64 is the accepted prototype candidate; its shape queries run internally in millimetres because metre-scale curved-mesh departure produced an incorrect blocking normal. Public coordinates stay in metres. This is a numerical representation choice; production dependency adoption and the fly's actual support shape remain20's responsibility.

### Contact-query ownership (slice20 component) — sound, medium confidence

Use stable numeric surface IDs and resolve exact equal-time hits by ID so input ordering cannot change the chosen contact. The core owns immutable, bounded mesh construction and rejects invalid shapes or unconverged query results. A convex hull is positioned relative to the native support pivot and oriented using the support normal and planar heading; this avoids silently turning the existing horizontal radius into a spherical body. The native all-animation hull remains a measured candidate until its feet/contact are inspected in the browser.

The query-only Parry dependency is now adopted in sim, with the proven internal normalization. Scene and hull budgets bound preparation work; they are generous authoring limits, not a measured100-fly performance guarantee. Existing body decisions remain authoritative and must consume this boundary during20 integration; a parallel controller is not an accepted final state.

### Supported model orientation (slice20 component) — sound, high confidence

When a fly rests on a slope, the core exports the model rotation as four quaternion components. The renderer applies that rotation to the model, its selection ring and followed centre instead of independently deriving slope angles. The plan required matching support normals without selecting the transport representation. This gives collision and display the same native asset orientation; future recorded supported poses must use this owner. Fixed query output in the workbench is diagnostic evidence only and does not replace a recorded attempt.

### Physical floor landing (slice20 component) — sound, medium confidence

A neural landing pulse now begins an airborne descent instead of instantly declaring the body grounded while its animation is still above the floor. Landing retains the flight steering and energy cost until touchdown; only then can the next neural/body step start feeding. The plan required physical contact but did not specify the intermediate mode or vertical speed. The provisional envelope retains the former0.6m visual flight height and0.8s full descent duration, using linear0.75m/s ascent/descent. These are game-model values, not biological measurements. This changes timing and potentially campaign outcomes; final level calibration must use the new body behavior. Adjusting this envelope belongs to the core, never a second renderer-height rule.

Record schema2 carries native height as a64-bit value and adds Landing to its mode table. A paused or rewound fly and its white trail read the same height; animation moves limbs only. The old schema is rejected because this unshipped game has no saved-replay compatibility requirement. Setup shows the authored spawn area without manufacturing fixed-state fly heights before an attempt exists.

### Meal diagnostic runway (slice20 component) — sound, high confidence

The floor meal probe now includes0.3m more food radius because a fly can travel up to0.272m horizontally during the newly physical full descent. With the old patch, the original seed began landing over food but touched down past its edge and starved without a meal. The plan did not specify how controlled probes adapt when contact timing changes. Both ordinary and proboscis-silenced arms keep the same enlarged patch, seed and gains; the unchanged gate still requires a real meal, later contact loss and starvation, and no meal under silencing. This is controlled flat diagnostic content, not the size of a campaign fruit or final level evidence.

### Native-scale and vertical trails (slice20 integration) — sound, high confidence

When a millimetre fly rises, a world-space minimum trail width can become a broad stripe at close zoom. Trail ribbons now ask the shared camera to offset each edge by pixels at that endpoint's depth. Their centre follows the recorded three-dimensional path, including pure ascent/descent; a depth bias keeps ground cues readable without the old12mm height lift. The plan required readable white trails but did not select this representation. This removes world-size clamps and a second projection estimate while retaining depth-tested world geometry, bounded history and the existing1.5px target width.

## Authored food geometry preparation — 2026-09-07

### Sound — medium confidence: preserve exported coordinates exactly through JSON

When Blender exports a vertex, the browser reads its binary coordinate. Rust reads a generated text copy for contact queries. Its default JSON parser changed the final binary digit of some coordinates, so the two sides did not receive precisely the same surface. Enable the existing JSON library's exact floating-point parsing feature rather than weakening the equality check. The plan required shared geometry but did not specify parsing mode. This applies to core JSON inputs and constrains future asset baking to preserve their numeric values; no new library is added. The cost is the parser's exact conversion work during loading, with no extra per-tick conversion.

## Food geometry and attempt ownership — 2026-09-07

### Sound — medium confidence: retain the contact radius until supported movement lands

A walking fly currently qualifies for taste only when its recorded root is within the existing modeled body radius of an edible triangle. The check measures the actual three-dimensional surface, so neither a distant odor nor a point deep inside an apple counts. This removes the former oversized edible circle, but it does not yet resolve a fly body landing or walking on the apple. The plan split geometry from supported movement; this checkpoint keeps that remaining work explicit. Replace this provisional proximity envelope with the accepted native support/contact state in the next20 pass, before treating apple feeding as complete.

### Sound — high confidence: surface IDs belong to an immutable attempt

Resolving a setup numbers fixed food first and then food placements sorted by placement ID. Every fly in that attempt sees those same numbers and geometry. Removing or adding a tool creates a different setup and a new attempt; IDs need not describe the same fruit across different attempts. The plan requested stable identity but did not require cross-attempt persistence. This keeps records tied to their immutable setup without another global identity registry.

### Sound — high confidence: return food geometry with atomic setup state

When a placement edit succeeds, its placement list, remaining inventory and resolved food triangles travel together. A rejected edit leaves that state unchanged. The attempt uses those same surfaces to prepare one shared query scene; authored floor patches render directly from them, while placed apples use the matching GLB at native scale. The plan did not specify where the resolved triangles belonged in the setup reply. Keeping them in the state avoids a second asynchronous geometry update and lets future editors render fixed food without reconstructing physics in TypeScript.


### Triangle-plane classification for supported translation

- **When:**20 native tangent-query correction.
- **Choice:** Exclude only a triangle that cannot obstruct the requested translation. When a fly sits on a floor and moves sideways, tiny numerical errors previously made the collision query stop it. The query now checks each nearby triangle's flat plane first: if the whole fly stays on one side, that triangle is skipped, while a wall belonging to the same mesh can still stop the move. A plane-position tolerance of10nm matches the existing query regression precision; the model and its position are not lifted by that amount.
- **Gap:** The plan required reliable native support but did not prescribe how to classify near-tangent numerical contacts.
- **Reach:** Fixed-orientation translations use this check in the existing prepared query owner. It does not authorize skipping entire objects, tolerating visible penetration, or choosing a walking controller. Changing orientation still requires separate physical resolution.
- **Verdict:** Sound — preserves nearby blocking faces and replaces the measured false obstruction without adding a clearance shell.
- **Confidence:** High.


### Support sampling does not choose physical movement

- **When:**20 native support-sampling preparation.
- **Choice:** Keep geometric placement separate from permission to move. On a sloping apple, the point where a foot touches can lie sideways from the fly's origin. The shared Rust sampler now returns both the supported origin and the touching point, plus the core orientation. It considers the named surface only. The body must first establish that the fly can reach that configuration; calling this sampler does not itself land the fly or let a floor walker jump onto food.
- **Gap:** The spec required authoritative supported roots and replay but did not define the geometric sampling operation or its relationship to acquisition.
- **Reach:** Body movement and future buffered path generation can share this query. Runtime replay strategy, orientation policy and hull adoption remain open; no main-thread physics path is implied.
- **Verdict:** Sound — keeps one geometry owner while preventing a valid destination from masquerading as a physically valid transition.
- **Confidence:** High.


## Support record and native asset preparation — 2026-09-07

### Sound — medium confidence: retain the measured native animation envelope as a candidate

When a fly animates, its legs and wings occupy different positions. The prepared
contact asset retains the full convex envelope of the sampled native animation,
without reducing its vertices yet. A convex envelope fills the spaces between
parts, so this is a candidate physical shape, not a claim of exact insect anatomy
or guaranteed coverage between animation samples. The plan left the final hull
open. Actual moving contact and measured cost must decide whether this candidate
is adopted; detailed geometry alone is not a reason to keep an unsuitable shape.

### Sound — medium confidence: reject invalid recorded rotations at the archive boundary

A quaternion is four numbers describing the fly's orientation. If a transferred
record contains a nonfinite value or a quaternion whose squared length differs
from one by more than one hundred-millionth, decoding rejects the chunk before
retaining its buffers. Silently using it could distort the model or camera. The
plan did not specify a numeric validation tolerance. This preserves ordinary
floating-point roundoff while requiring both native and browser readers to agree;
it does not authorize geometric penetration or a replay position tolerance.

### Sound — high confidence: reserve one packed integer for absent support

Food ID zero must remain a usable identity. Packed records therefore reserve the
largest unsigned 32-bit integer for no support and export that marker beside the
field offsets. A grounded floor fly and an airborne fly both have no food ID;
their recorded mode distinguishes them. The plan required identity but did not
choose its binary encoding. This avoids an extra nullable buffer and keeps the
existing bounded archive owner responsible for all recorded state.

### Sound — medium confidence: interpolate recorded orientation along the short arc

Between two recorded frames, the browser turns the fly along the shorter rotation
between their quaternions, using the existing shared interpolation owner. This
prevents a small heading change across a full-turn boundary from making the model
spin the long way around. The plan required smooth recorded orientation but did
not choose the interpolation rule. This rule only describes orientation: it does
not prove that a straight root path remains outside curved fruit. Supported replay
must carry an accepted continuous path before its contact can be approved.

## Native furniture identity — 2026-09-07

### Sound — medium confidence: quarter turns retain the existing solid geometry

When a cabinet faces another wall, its appearance records one of four right-angle orientations. Turning it ninety degrees also requires swapping its physical width and depth; otherwise placement is rejected. The plan required appearance identity on existing solids but left orientation encoding open. Arbitrary angles would require a different collision representation. Quarter turns support the current axis-aligned rooms without silently adding that larger physics scope. Unfurnished solids retain a plain appearance through an absent furnishing identity.

### Sound — medium confidence: explicit precision tolerances for native envelopes

A cabinet exported from Blender can differ microscopically from its intended size because the GLB stores lower-precision numbers. Browser loading permits one millionth of a metre of envelope error; core placement permits one billionth when comparing decimal footprint dimensions. The plan did not choose these tolerances. They admit numerical rounding while rejecting a visibly stretched or wrongly oriented furnishing. These bounds apply to furniture dimensions only, not food penetration or contact replay.

### Sound — high confidence: one shared native catalogue

If an artist changes a sofa's intended size, Blender, the simulation and browser read the same catalogue. An outdated exported model fails validation instead of being stretched into the new footprint. The plan required native dimensions but did not choose their storage owner. Keeping this small shared asset contract avoids separately maintained dimensions in three languages; the catalogue also participates in simulation build identity.

### Sound — high confidence: templates own furniture resources by model

When a cabinet model is replaced, all its placements use the new shared mesh, and the old cabinet resources are released. Sofa meshes remain alive. The plan left resource ownership unspecified. One template per required model supports repeated furniture without loading a copy per placement, while one shared loader serves both browser applications. Temporary loading boxes use the same existing solid footprint; they do not become alternate authored assets or collision owners.

## Conservative native envelope preparation — 2026-09-07

### Sound — medium confidence: numerical containment is an export rejection rule

When the smaller shape is rebuilt, floating-point arithmetic can report a source
point a vanishing distance outside it. Preparation allows only scale-dependent
roundoff in this check; it never expands a plane or changes the contact query's
clearance. The plan left numerical export validation unspecified. This avoids
turning arithmetic noise into a visible gap, while retaining an explicit limit
on claims of containment. It is numerical validation, not a formal exact proof.

### Sound — high confidence: prepare a fixed reviewed candidate before adoption

The same fly model can produce a detailed reference and a smaller collision
candidate. Preparation records the 128-plane version and both source identities,
so movement tests can compare the exact same shapes repeatedly. The plan required
choosing a usable native representation but did not set the simplification
budget. The candidate stays unused by the game until moving contact and cost
pass; changing the budget regenerates a reviewable asset rather than silently
altering every fly's physics.

### Sound — high confidence: native geometry preparation shares the Rust dependency

When the asset exporter requests the smaller shape, an offline Rust example uses
the same geometry library as the simulation. The browser receives no extra
geometry implementation or dependency. The plan left the preparation language
open. This keeps the difficult hull operations with their existing library and
lets the TypeScript animation exporter remain the owner of sampled source poses.

## Original-plane boundary ownership — 2026-09-07

### Sound — medium confidence: retain tiny positive edges in the prepared candidate

Some construction planes meet along edges far smaller than a visible pixel.
Preparation keeps their distinct identities because exact arithmetic confirms
that they are positive edges of the saved planes. The plan did not specify when
to merge almost coincident features. A proximity merge could silently change
which faces are neighbors. Keeping the source connections makes that decision
explicit for the moving-path owner, which must handle effectively simultaneous
transitions without cycling. This is a prepared candidate choice, not acceptance
of its eventual runtime cost.

### Sound — high confidence: construction planes own the contact boundary

The geometry library can answer point-support queries correctly while reporting
incorrect face connections for this almost coplanar shape. The asset therefore
keeps its original construction planes and derives one vertex array plus edge
connections from those planes. The plan required a faithful bounded shape but
left its feature representation open. Future contact code can use the saved
boundary directly instead of rebuilding an invalid one from points. Point-query
and boundary data remain parts of the same prepared shape.

### Sound — high confidence: certify the saved units, not only intermediate arithmetic

When millimetre calculations are saved as metre values, rounding can change a
very short edge's mathematical sign. The exact offline audit checks the saved
plane coefficients and records the candidate's hash. The plan did not prescribe
that audit boundary. This prevents a correct intermediate result from standing
in for a differently rounded asset; a future replacement needs its own audit.
No exact-integer calculation or new dependency is added to browser simulation.

## Banana shape preparation — 2026-09-07

### Sound — medium confidence: use a household-sized single closed banana

A future room can contain a banana approximately 22 cm long and 4 cm thick, lying
on its side. Its skin, stalk and blossom tip form one closed surface rather than
separate overlapping collision pieces. The user requested bananas but did not
choose their size or shape representation. These native dimensions give later
contact and room composition a concrete starting point; the fruit remains an
unregistered shape study, so this does not set food capacity or level difficulty.

### Sound — high confidence: inspect GLB topology without changing the source mesh

Export can duplicate a mesh vertex for different shading attributes. The banana
validator temporarily welds vertices within 10 nm before checking manifold edges
and self-overlap, then discards that inspection mesh. The plan required geometry
integrity but left that inspection method open. The authored and exported models
retain their exact vertices; this validation tolerance does not become collision
clearance or an automatic asset repair.

## Plant shape refinement — 2026-09-07

### Sound — medium confidence: bury leaf bases slightly in the authored soil

When viewing the plant close up, each leaf now enters the visible soil by 1 mm
instead of ending above it. The plan specified a realistic houseplant but left
this attachment detail open. This makes the leaf and soil look connected while
preserving separate editable meshes. It is an art overlap, not a fly collision
allowance; foliage and recessed-soil contact still need their own integration.
The sparse blade arrangement and softened planter rim are delegated shape work.

## Fixed-orientation support prefixes — 2026-09-07

### Sound — medium confidence: one closed food boundary per surface identity

When an authored food is loaded, its mesh must be one connected, outward-facing
closed boundary. Adding a detached open triangle or another closed object to that
same identity is rejected; separate foods can use separate identities. Disconnected
open patches remain allowed for floor-food diagnostics. The plan required honest
inside-food detection but left mixed mesh semantics open. This restriction avoids
an open scrap hiding a closed food's interior and keeps later authoring explicit.
It does not automatically repair or weld contact geometry.

### Sound — medium confidence: expose logical work and storage budgets for path experiments

A caller trying a support path supplies limits for counted computation and live
array items. The query stops with an explicit error when either is exhausted,
instead of returning an incomplete path as finished. The plan required bounded
work but did not prescribe these counters. Existing geometry-kernel calls are
charged conservatively by triangle count; their internal iterations and allocator
capacity are not measured by these counters. The limits help compare candidate
paths, while browser timing and final archive limits still need direct evidence.

## Contact geometry across shading seams — 2026-09-07

### Sound — medium confidence: exactly coincident rendered positions share contact identity

A flat banana cut face needs different shading normals from its curved skin, so
the GLB can store the same position more than once. The contact exporter now gives
those identical transformed positions one vertex identity while retaining every
triangle. The plan required matching visible and physical surfaces but did not
specify how shading splits map to topology. This prevents a closed fruit from
being mistaken for an open surface. It applies across primitive boundaries, uses
no distance tolerance, and does not repair overlapping components; invalid face
arrangements still fail the existing contact validation.

## Neutral wall fixture preparation — 2026-09-07

### Sound — medium confidence: a compact shaded wall fixture is a separate appearance proposal

The requested house lighting needs a recognizable household fixture. The prepared
sconce uses a 22 × 32 × 16 cm envelope and a flat rear mounting plane, with its
local origin beneath the model. The plan left the fixture size and installation
convention open. This proposal adds no gameplay light, collision or mounting
height: later placement must explicitly position it on a wall and verify scale.
The geometry can be replaced before that adoption without changing game rules.

## Rotating contact research bounds — 2026-09-07

### Sound — medium confidence: incomplete geometric experiments fail explicitly

When a rotating fly changes which part touches a fruit, the experiment considers
a small bounded group of possible contact formulas. It checks the whole time
interval before accepting their combined path. The plan required bounded work
but did not prescribe a research representation; current caps limit active
formulas, subdivision and separating-direction proposals. A closest-point query
may suggest a direction to check, but cannot itself certify safety. Exhausting a
cap produces an unresolved result, never a successful path or a gameplay stop.
These are experiment limits, not final runtime budgets. General feature coverage,
exact initial contact and browser performance must be established before adoption.

### Numerical contact method after actual-request failure

**Sound correction; numerical limits provisional.** Formal certificates were an agent-selected way to prove movement, not a user requirement. Actual neural requests make that method impractical, so use bounded numerical trajectories with independent dense checks and convergence evidence. Preserve10nm query regressions; provisionally cap additional path/replay error at3µm and visible maximum-close error at0.25CSSpixel. Target zero penetration. The128segment/512query diagnostic caps expose unresolved work rather than modifying neural intent or creating obstacles. Lifecycle, shared replay and twenty-fly measured cost still decide adoption.

### Shared skeletons within each cloned fly

**Sound; high confidence.** Preserve the original model's shared skeleton when cloning its meshes, but give every fly independent bones and texture storage. Implement this in the existing pinned Three.js patch, where cloning already belongs, rather than adding an application clone/disposal wrapper. Remove the patch when upstream passes the real-model ownership and animation regression.

### Native household shape inspection

**Sound; medium-high confidence.** Give the existing asset workbench a disposable appearance-only slot for reviewing native household models before their physical placement rules are accepted. This does not register new gameplay obstacles or lights. A named lower mounting view exposes hardware hidden by the RTS angle; leaving that view restores the ordinary game camera. Remove the dedicated inspection composition once accepted physical placement can supply the same review fixture. Diagnostic mounting positions are reversible review assumptions.

### Shared numerical replay ownership

**Sound; high confidence.** Return the completed movement alongside each body step's events, rather than storing another mutable last-step buffer. Pack that path in the existing archive and sample it through the same Rust routine on the playback thread, using the existing WASM module without another brain or world. Only the requested tick is copied for sampling. This prevents replay from cutting a different route through food.

**Sound; medium confidence, capacity acceptance pending.** Use the existing128MiB cap as a cumulative quota for variable-length movement records, rejecting overflow explicitly on both producer and consumer. Store all retained knots initially, including endpoints, to keep one transparent representation; measure actual campaign storage before accepting this format for release. Internal layout changes replace both ends together, with no compatibility reader.

### Exterior camera range and grass batches

**Sound; medium confidence.** Maximum zoom uses the centred whole-house distance. When following a fly near an edge, opposite rooms may leave the frame; the player can pan to them. The user delegated coordinated grass radius and camera limits. A fixed full-house distance avoids making the lawn much larger just because a fly moved. Uniform grass is split into static spatial batches so the renderer can omit offscreen blades without a second detail system. The finite density cap is provisional: very wide layouts can make individual blades look sparse at close range. This is an appearance choice, with no physical or neural effect; final realism remains open.
## Campaign content ownership

The user requested immediate playable integration of the two existing authored puzzles while balancing continues. These entries now populate the home campaign registry. Setup receives level/tuning/catalog content; the core catalog travels through its own typed worker command rather than a production dependency on the diagnostic fixture. Progress and sequential unlocks belong to the campaign shell, while each selected level owns an isolated editor/attempt lifetime. Test-authored progression content never joins the release registry.

Campaign integration preserves each prepared room topology, inventory, duration, stars and cue gains. Both entries use the current setup body configuration and reserve, anatomical antenna dimensions, and the core randomized cluster owner with ten flying and ten walking starts. Their cluster bounds reuse the authored starting envelope. This migrates obsolete physical values without claiming that the old seed acceptance survives; final puzzle balance and food dependence remain open.

### Initial warm household materials and placement

**Sound; medium confidence.** Use locally embedded CC0 photographic oak maps, ivory walls, walnut/brass cabinets and sage upholstery as the first warm-house treatment. Room-scaled floor UVs preserve real board width while sharing the textures. Place native cabinets along rear walls and sofas in side rooms, leaving the main passage and initial swarm clear. The user chose a warm lived-in house but delegated individual finishes and furniture positions; these are reversible art and level-design choices. Final fabric/plaster detail, decoration, lighting and puzzle balance remain open.

## Household light integration

- **When:** room-detail integration after27d42ac. **Choice:** wall lamps use small point lights without individual shadow maps. When a foreground wall fades, its lamp model disappears with it but the light stays, so the room does not suddenly darken. **Gap:** the visual contract asked for household lights without specifying shadow allocation or cutaway light behavior. **Reach:** lights remain decorative; they do not add neural light cues. Final lighting can add shadows if measured browser cost permits. **Verdict:** sound, provisional for final illumination. **Confidence:** medium; stable room lighting helps camera readability, but unshadowed pools still need art review.

## Domestic layout integration

- **When:** the user's room-proportion and door-size corrections. **Choice:** keep the first escape route within the living room while allowing adjacent rooms to be explored. A new player can aim at a nearby exit without having to understand the entire five-room house first. **Gap:** all five rooms were required to exist, but the route through them was not specified. **Reach:** first-level teaching comes from a short route; the second house owns the longer hall-and-kitchen challenge. **Verdict:** sound, provisional pending campaign balance. **Confidence:** medium; this preserves believable room dimensions and an approachable first task, but useful placement effects still require validation.

- **When:** doorway visual integration. **Choice:** keep interior doorway surrounds faintly visible even when their walls are cut away. Otherwise normal-height frames form a dense screen of opaque uprights in the angled view. **Gap:** the user specified transparent obstructing walls without separately defining doorway-frame opacity. **Reach:** the current doorway asset is used for interior passages only; future exterior entrances should choose visibility with their wall. **Verdict:** sound. **Confidence:** medium; this preserves passage identity and reduces obstruction, while final camera composition remains open.

## Fan strength for domestic rooms

- **When:** first-level fan calibration. **Choice:** the fan's strongest wind is now 3 metres per second, fading with distance and blocked by walls. When players point a fan toward a door, its push can overcome a fly's sideways wandering; the neural model still produces all motor activity. **Gap:** the plan delegated tool tuning without fixing appliance strength. **Reach:** both levels use the same catalog value, so old weak-fan level calibration is superseded. **Verdict:** sound, pending full campaign distribution checks. **Confidence:** medium; three first-level comparisons show a strong placement benefit and production contact limits pass, but the second-level strategy still needs work.

## Study and kitchen furnishing shapes

- **When:** native domestic furnishing integration. **Choice:** use closed-base furniture and a combined kitchen run. A fly sees the same occupied floor space that the collision model blocks; a chair drawn with widely separated legs would otherwise appear to offer a passage the model refuses. **Gap:** the user requested ordinary rooms and furniture without specifying individual furniture styles. **Reach:** these shapes keep the existing collision owner; future open-leg furniture needs actual clearance represented by that owner. **Verdict:** sound, provisional for final art review. **Confidence:** medium; this keeps the room navigable and physically legible, but the writing desk looks more like a drawered workstation than a conventional knee-space desk.
