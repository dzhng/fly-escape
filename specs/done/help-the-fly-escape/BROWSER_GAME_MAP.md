> Historical discovery interview. References to retired Python modules name the spike implementation at the time of the interview; the shipped rationale is [README.md](README.md).

> Discovery record, superseded by [the implementation plan](README.md) on 2026-09-06. Its kickoff prompt, open questions, and proposed next steps are historical. Follow the plan’s Next Agent Prompt and contracts.

# Help the Fly Escape — browser game discovery map

Status: quadrant walk complete; implementation has not begun. This map records the browser-game direction agreed with David on 2026-09-06. It supersedes conflicting scope and product constraints in the older Python tech-demo spec. The old slices remain historical inputs, not the browser implementation plan.

## 1. Known knowns — settled ground

The player helps flies escape a house by placing sensory tools. The MaleCNS-derived leaky integrate-and-fire network remains the source of neural behavior. Environmental sensing and physical movement are modeled interfaces; their approximations must be explained honestly. No hidden goal steering, pathfinding autopilot, or contact-only feeding.

The updated repository contains the Origin Python simulation, including graph extraction, sensory injection, locomotion and behavior systems. The implementation reference is the simulation (`../../../src/feeding_maze_sim.py`, retired spike), graph extraction (`../../../src/graph_loader.py`, retired spike), neural dynamics (`../../../src/lif_sim.py`, retired spike), and behavior system (`../../../src/landing_feeding.py`, retired spike). These are reference mechanisms, not proof that every design claim is implemented correctly.

The browser computes locally, without an application backend. Serving static assets through localhost during development is the working interpretation. Desktop/laptop browsers are the first target; mobile is deferred. David authorizes replacing existing code and data for a clean structure similar to `/Users/david/dev/game`; deletion is permitted, not an instruction to discard evidence before extracting it.

## 2. Known unknowns — decision ledger

| Question | Answer and why | Closed by |
|---|---|---|
| Product scope | Complete small puzzle game: placement, swarm scoring, retries and saved progress. | User |
| Content | Five levels crafted by the implementing agent, easy to hard. First level has five rooms; later levels grow. Layouts teach through play. | User |
| Room connectivity | Dead-end rooms are intentional; a room may have just one doorway. Not every room needs separate entrance/exit connections or to lie on the route to freedom. Include branches, useful side rooms and tempting dead ends as the level design warrants. | User |
| Separate tutorial | None. The first level is the de facto tutorial. | User |
| Swarm size | Twenty flies in every MVP level. Support up to 100 later; avoid hardcoding 20 into simulation and replay formats. | User |
| Runtime presentation | Compute ahead into a buffer; start viewing before the episode finishes when the buffer can sustain smooth playback. Do not require live computation to match every rendered frame. | User |
| Platform | Desktop/laptop browsers first. | User |
| Camera | Fully 3D angled dollhouse/open roof, fixed viewing angle and RTS scrolling. Default view is close; the whole-house mock is the minimum zoom. Selecting a fly in the world or its card enters close follow mode; auto-pan keeps that fly centered while the player freely adjusts zoom. Rotation later. | User |
| Economy | Fixed per-level tool inventory; no shop or currency. Placement and combinations supply the puzzle. | User |
| Progression | Sequential unlocks. One star opens the next level; two and three reward more escapes. Tune thresholds per level. | User |
| Randomness | Fresh seeds per attempt. Replaying an attempt preserves its outcome and activity. | User |
| Food | Feeding replenishes a finite reserve; hunger returns. Food stops extend survival and matter on large maps. Only escape earns escape score. | User |
| Neural display | Both grouped pathway network visualization and activity traces, for all flies in a scrollable panel. Full individual-neuron rendering is not required. | User |
| Selection | World fly and panel card are equivalent selection controls. Selection highlights both, scrolls to the entry, and locks a close follow camera to that fly. | User |
| Trails | White trails make small flies trackable. Short fading trails and a stronger selected trail are proposed defaults. | User / proposed default |

Proposed interaction defaults shown during the walk: freely move/remove tools before Run, freeze placement during the attempt, and restore the setup for editing on Retry. These have not received a separate explicit answer; retain as visible defaults for the first playable checkpoint.

### Explicitly OPEN — resolve through evidence or the next spec

| Item | Current recommendation | What closes it |
|---|---|---|
| Language boundary | Rust simulation with a thin WASM boundary; TypeScript presentation. Separate simulation authority from rendering as in `/Users/david/dev/game`. Run heavy work off the UI thread. | Browser feasibility benchmark and implementation spec; no speedup is assumed. |
| Graph asset | Prepare the real subgraph offline, export a compact versioned browser asset with IDs, pathway membership and provenance. | Restore source data, reproduce extraction and inspect the exported graph. |
| Browser support/performance | Benchmark the full simulation plus telemetry at 1, 20 and 100 flies. The latter is a future-capacity probe, not an MVP live-performance promise. | Named desktop browser/device baseline, measured throughput, memory and load time. |
| Buffer policy | Bounded simulation-ahead queue; poses and neural data share timestamps. | Measure sustained production/consumption rates, decide initial wait, episode duration, supported playback speeds and underrun handling. A short lead alone cannot cure sustained underproduction. |
| Telemetry | Record grouped pathway activity, sensory inputs, motor output and behavior for every fly, synchronized with playback. | Define group membership, aggregation, cadence, trace meaning and retention; measure memory. No fabricated activity. |
| Anatomy | A grouped schematic network is sufficient. Never label an invented layout as anatomical. | Source coordinate inspection only if anatomical placement is later desired. |
| Renderer | Fully 3D models, scene, lighting and camera. Use available Blender MCP capabilities for asset creation/preparation. Preserve a small camera/picking boundary; no need to copy the reference game's entire renderer architecture. The UI mock may use illustrations. | Choose browser coverage, lighting/art target and engine during the spec/prototype. |
| Five-level details | Agent designs increasing room counts, layouts, inventories and mechanic introductions. | Concrete layouts and repeated seed-set playtests; first-level friendliness and placement benefit must be measured. |
| Score and survival tuning | Tune star thresholds, food replenishment, depletion and time limits to make routes meaningful. | Multi-seed evidence, including poor placements and successful reference solutions. |
| Remaining UX | Exact RTS controls, placement validity/overlap, fan direction, pause/speed/replay controls, audio and persistence details. | Document defaults in the implementation spec and expose them in the first playable; material product departures return to David. |

## 3. Unknown knowns — taste and context extracted

- Audience: David and technically curious friends, with **no assumed neuroscience knowledge**. This revised the earlier assumption that technical curiosity justified specialist labels alone.
- Science stays visible alongside play. All twenty flies have panel entries, each combining a grouped pathway network with traces. Clicking a fly focuses its own data instead of replacing the all-fly view.
- Plain-language labels lead; neuroscience terms and detailed explanations live in tooltips. Explain the biological role, what is actually measured, and where this simulation approximates biology. Example: “Smell response · Olfactory pathway.” Activity is not evidence of a conscious decision or proof that one pathway caused a particular turn.
- The house remains readable at an RTS-like angle. White trails help track tiny flies. The inherited whimsical cool interior/warm orange exit direction is a working visual default; a rendered art sample still needs reaction.
- The player learns through progressively harder authored levels. No separate tutorial mode or science lecture is required to start playing.
- A grouped display reduces visual and recording complexity without replacing the underlying neural simulation with a simpler AI.
- Mock feedback: the initial whole-house view is the furthest zoom-out, not the default. Close viewing must show a detailed 3D fly model in the implementation. Selecting from either surface follows the fly continuously without overriding the player's subsequent zoom. Dragging or Overview to release follow is a proposed interaction default shown during the mock pass.

## 4. Unknown unknowns — landmines and consequences

Coverage: targeted sweep of the eight core simulation modules (`graph_loader`, `lif_sim`, `olfaction`, `feeding_maze_sim`, `landing_feeding`, `flight`, `maze`, `house_level`), plus swarm/performance runners and download paths. Legacy alternative simulators were inventoried, not exhaustively audited. No browser benchmark or biological validation was run. This is not an exhaustive defect review.

| Finding and evidence | Why it bites / required response | Status |
|---|---|---|
| Timeout after any feeding returns `WON`; swarm code calls `WON` an escape. Simulation (`../../../src/feeding_maze_sim.py#L659`, retired spike), runner (`../../../run_swarm_test.py#L38`, retired spike) | Historical escape rates may mix survival and escape. Browser scoring must require the actual exit crossing; rerun behavior measurements. | Decided: escape-only score |
| Exit becomes a Gaussian odor source without room/LOS gating. Source construction (`../../../src/feeding_maze_sim.py#L253`, retired spike) | A physical baffle alone does not block this scent calculation. Add explicit near-field, room and visibility rules for the exit cue. | Sharp edge; carry into spec |
| Contact plus hunger can initiate feeding without neural activity. Behavior (`../../../src/landing_feeding.py#L923`, retired spike) | Violates the retained neural feeding constraint. Remove the bypass and verify feeding via the neural readout. | Decided: neural activation required |
| Starvation checks whether the fly has ever fed. Behavior (`../../../src/landing_feeding.py#L880`, retired spike) | One meal currently prevents later starvation. Replace with a finite replenishable reserve. | Decided by user |
| Light and shadow intensities enter the same AOTU injection calculation. Scototaxis (`../../../src/landing_feeding.py#L669`, retired spike) | Claimed opposite responses are not established by that implementation. Probe signs and lateral mapping before designing puzzles around them. | OPEN: controlled probe |
| Main feeding simulator samples simple Gaussian sources, despite advection support elsewhere. Source (`../../../src/feeding_maze_sim.py#L63`, retired spike), sampling (`../../../src/olfaction.py#L319`, retired spike), field (`../../../src/maze.py#L518`, retired spike) | Displayed wind/plumes could disagree with sensed odors. Use a single environment field and verify physical wind behavior. | Sharp edge |
| Required raw data is absent; downloader paths and filenames differ. Loader (`../../../src/graph_loader.py#L55`, retired spike), Python downloader (`../../../scripts/download_connectome.py`, retired spike), JS downloader (`../../../scripts/download-neurons.js`, retired spike) | The source is recovered but not runnable from present data. Establish one reproducible asset-preparation path; do not download raw feathers in the player runtime. | OPEN: data preparation |
| `visual_motor` retains seed-touching edges rather than every edge among selected neurons. Extraction (`../../../src/graph_loader.py#L408`, retired spike) | A generic induced-subgraph rebuild would change connectivity and cost. Specify extraction and version the resulting asset. | Sharp edge |
| Historical timing is Python evidence; game time and neural time are distinct. Timebase (`../../../src/landing_feeding.py#L269`, retired spike), audit (`../../../perf_audit.py#L154`, retired spike) | Simulation ticks are not rendered frames; 100-fly figures are not browser results. Benchmark full work including telemetry and verify completed episodes do not inflate throughput with no-op steps. | OPEN: benchmark |
| Recording every neuron's voltage grows rapidly. | Illustrative calculation: 70,000 neurons × 20 flies × 3,000 ticks × 4 bytes = 16.8 GB. Record grouped activity for the chosen UI, not full voltage histories. Offscreen entries need not be drawn, but their data must remain available. | Decided display; format OPEN |
| Fresh seeds plus sequential unlocks can reward lucky retries. | Balance over repeated seed sets rather than one successful run. Good placement should improve the distribution, especially in level one. Preserve attempt seeds for reproducibility without making gameplay retries fixed-seed. | Sharp edge |

### Builder confirmations before claiming readiness

Confirm data provenance and extraction, pathway membership and signs, scoring/feeding rules, simulation time units, browser/device budget, buffer stability, telemetry memory, tooltip accuracy, and a demonstrable placement benefit for each authored level. Exact star thresholds, room counts after level one, inventories and depletion values are tuning decisions—not values silently inherited from the spike.

## Handoff

This map is the discovery deliverable, not an authorization to execute the older Python slices. Next, write a browser-specific implementation spec with a data/behavior/performance checkpoint before the five-level build. Keep deviations and newly discovered decisions attached to this map.

Copyable next message:

> Write the browser-game implementation spec from BROWSER_GAME_MAP.md. Use the agreed product decisions, make remaining proposed defaults concrete and reviewable, and put graph preparation, neural behavior checks, buffered playback and all-fly telemetry benchmarks before building the five levels. Keep the architecture similar to ~/dev/game, scaled to this project.
