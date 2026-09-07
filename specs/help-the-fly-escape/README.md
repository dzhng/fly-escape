# Help the Fly Escape — browser game

Status: **implementation active — physical scale, furnished rooms and two levels**. Last updated: 2026-09-08.

Build a local, fully 3D browser game in which the player places environmental objects and watches a real connectome-driven swarm attempt to escape. The [game contract](GAMEPLAY.md) owns user requirements; [architecture contracts](CONTRACTS.md) own runtime/data seams. This plan replaces the previous Python tech-demo scope.

## Next Agent Prompt

Finish the two-level game through [30 — Household objects and hazards](slices/30-household-objects.md), then campaign calibration and final release gates. Exactly two crafted levels, twenty flies, one fan maximum, object discovery and meaningful eating remain the target. Do not return to chained-fan puzzles or the rejected microscopic contact-certificate program.

The current highest-risk gap is reliable food-seeking. Cold-start tests support repulsion; neither the current attraction binding nor the [DM1 receptor-input experiment](assets/evidence/30/dm1-input/report.md) produces reliable approach. A [matched browser comparison](assets/evidence/20/feeding-benefit/README.md) confirms reserve replenishment extends the lives of flies that feed on the controlled flat patch; it does not establish curved-fruit or campaign food-seeking. A user decision between strict connectome control and a clearly labeled simplified neural model is pending. Preserve the current architecture until answered; independent art and hazard work can continue. Do not increase gains blindly, enlarge invisible food regions or insert goal-directed steering.

Both native hazards are integrated: the second house's [zapper](assets/evidence/30/native-zapper/report.md) and the first house's [spider web](assets/evidence/30/native-web/README.md). Web contact yields caught, including recorded replay and counters; gaps remain passable. Hazard contact, food eligibility and sensory sources remain separate. Fixed objects never spend editable inventory. Web attachment strands and natural irregularity remain art work.

The [captured seed 42 collision regression](assets/evidence/30/seed42-contact/README.md) is resolved in native and rebuilt production browser runs. Unsafe or unresolved angular requests retain the exact verified orientation; translation still runs, and invalid impact candidates retain the safe prefix. No tolerance, query budget or neural outputs changed. Pause/reverse/resize pixels match; the full run completes without errors or underruns. [Failure-state recovery](assets/evidence/17/failure-recovery/README.md) also preserves the frozen view across resize and permits a fresh attempt. This is collision evidence, not campaign solvability.

Both furnished houses, ordinary doorways, foreground wall cutaway, open exits, random mixed starts and progression are integrated. The [meadow/object tray pass](assets/evidence/30/meadow-tray/README.md) provides native fan/bottle images, fixed fan headings, always-visible objects and console diagnostics. Final material realism, vegetation, illumination and furnished follow readability remain open. Preserve wheel zoom, RTS panning, selected-fly follow and zoom-readable flies.

Priority: resolve useful attraction and food benefit; craft and validate both puzzles; complete remaining visual gates; run final-build performance, cancellation/resource and platform checks. Prior [production attempts](assets/evidence/17/domestic-production/README.md) and [fruit-cost measurements](assets/evidence/17/fruit-cost/README.md) are component baselines, not final release acceptance. A committed pass is a checkpoint; continue through every open item.

## Global checklist and review map

Open the [interactive roadmap](visualizations/roadmap.html) for dependency and milestone navigation.

- [x] [01 — Reproducible graph and reference](slices/01-graph-reference.md) — dependencies: none.
- [x] [02 — One real brain in the browser](slices/02-neural-browser.md) — dependencies: 01.
- [x] [03 — One sensory environment](slices/03-sensory-fields.md) — dependencies: 02.
- [x] [04 — Finite life and physical escape](slices/04-lifecycle-outcomes.md) — dependencies: 03.
- [x] [05 — Twenty flies with buffered replay](slices/05-swarm-playback.md) — dependencies: 04.
- [x] [06 — Close framing and shared selection](slices/06-camera-selection.md) — dependencies: 05.
- [x] [07 — Blender fly and replacement workbench](slices/07-fly-silhouette.md) — dependencies: 06.
- [x] [08 — Playback-driven fly animation](slices/08-fly-motion.md) — dependencies: 07.
- [x] [09 — Readable white trails](slices/09-fly-trails.md) — dependencies: 08.
- [x] [10 — A readable 3D house](slices/10-house-geometry.md) — dependencies: 07.
- [x] [11 — House materials and color](slices/11-house-palette.md) — dependencies: 07,10.
- [x] [12 — Depth and exit lighting](slices/12-house-lighting.md) — dependencies: 11.
- [x] [13 — All-fly science and explanations](slices/13-science-panel.md) — dependencies: 05,06.
- [x] [14 — Editable setup and attempt loop](slices/14-placement-attempt.md) — dependencies: 05,06,10,13.
- [x] [18 — A natural starting swarm](slices/18-natural-starts.md) — dependencies: 05,14; required before final campaign calibration.
- [x] [19 — Physical proportions before detailed art](slices/19-proportions.md) — dependencies: 18 for integration; neutral authoring may proceed independently.
- [x] [25 — Physical scale and sensory sampling](slices/25-physical-scale.md) — physical adoption verified after26/27.
- [x] [26 — Continuous field sampling](slices/26-continuous-field-sampling.md) — dependency: 25 reproduction; required before physical adoption and 20.
- [x] [27 — Sensory sensitivity at anatomical scale](slices/27-sensory-sensitivity.md) — dependency: 26; diagnostic comparison before physical adoption.
- [x] [28 — Zoom-readable fly models](slices/28-zoom-readable-flies.md) — dependency:25; user-requested visual enlargement, physics unchanged.
- [x] [29 — Curved-surface query feasibility](slices/29-surface-query.md) — prerequisite for20 contact integration.
- [ ] [20 — Authoritative furnishing and food contact](slices/20-furnished-contact.md) — dependencies: 19,25.
- [ ] [21 — Recognizable household shapes](slices/21-house-shapes.md) — dependencies: 19,20.
- [ ] [22 — Natural authored materials](slices/22-house-surfaces.md) — includes a finite circular grass exterior and bounded rendering; dependencies: 21.
- [ ] [23 — Daylight and household illumination](slices/23-house-illumination.md) — dependencies: 22.
- [ ] [24 — Follow visibility in a furnished room](slices/24-furnished-readability.md) — dependencies: 23,18.
- [ ] [30 — Household objects and hazards](slices/30-household-objects.md) — required before final 15/16 calibration.
- [ ] [15 — Level 1 is the tutorial](slices/15-first-level.md) — dependencies: 18–24 and the accepted foundations.
- [ ] [16 — A carefully designed second level](slices/16-campaign.md) — dependencies: 15.
- [ ] [17 — Browser release and clean cutover](slices/17-static-release.md) — dependencies: 16.

## Standing gates and ownership

Every implementation pass preserves one owner per concept: graph/provenance in the exporter; neural dynamics, fields, geometry, body and results in their Rust modules; Worker transport/archive/playback in sim-client; projection/camera/assets in renderer; selected fly and UI attempt state in web. The panel consumes recorded values, the renderer consumes exported geometry, and no second simulation or pathfinding controller is allowed. Details and typed seams live in CONTRACTS.md.

The result should read as designed today, not as a web wrapper around the Python game. All existing code is disposable spike material: keep or adapt useful parts in their natural owners and delete outdated parts. Follow the [spike reuse policy](CONTRACTS.md#existing-spike-code). Keep Python only for offline graph preparation and focused reference fixtures that earn their place. The Worker reproduction spike is removed in 02; replaceable asymmetric model placeholders give way to Blender assets in 07 and 10; obsolete runtime paths/dependencies are removed as their useful consumers disappear, with a final audit in 17. No transitional compatibility owner survives release.

Every visual slice explicitly inherits [compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md) when it has a reference/prior look, using telemetry and a less-wrong verdict. It also runs an unprimed [screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md) as its last visual acceptance check. Each slice names one visual variable and crop/mask; unrelated visible wrongness belongs to another slice. Integration reviews combine only previously accepted variables.

Human shot reviews are non-blocking: use [preview-shots](../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while independent work continues, then make and record an evidence-based reversible decision if no response arrives and close the shots. This is not a new scope approval mechanism. Record failed probes as well as successful captures under the owning slice's `assets/evidence/NN/` folder.

Before closing a substantive pass, review ownership with [refactor-clean](../../.agents/skills/refactor-clean/SKILL.md), then the change with [code-review](../../.agents/skills/code-review/SKILL.md); keep docs focused on rationale and authoritative contracts. A failed scientific/performance gate blocks dependent content acceptance, not unrelated asset/harness work. Reslice measured problems; never quietly lower the 20-fly requirement, shrink the graph or add steering cheats.

## Evidence and remaining uncertainty

- [Integrated house](assets/evidence/10/production/review.md) consumes authored meshes with shared physical footprints, bounded loading and independently reviewed visibility.

- [Science panel preparation](assets/evidence/13/review.md): all-card diagrams, bounded packed traces and neuron explanations pass integrated browser and dependency checks.

- [Research and reproduction](RESEARCH.md): actual source defects, reference architecture, primary external documentation and reproduction spikes.
- [Draft synthesis](assets/planning/synthesis.md): three independent approaches, tradeoffs and scrollback audit.
- [UI reference evidence](assets/ui/mock-review.md): mock limits; nearby images include approved framing and the rejected focus indicator.
- [Discovery map](BROWSER_GAME_MAP.md): historical interview record, superseded by this plan.
- [Planning validation](assets/planning/review.md): review results for this specification, not game acceptance.

Remaining empirical gates are campaign reliability, useful placement effects and food dependence on larger maps, followed by final-build performance and platform coverage. Accepted component evidence stays with its owning slice; a newly measured regression reopens that contract explicitly.
