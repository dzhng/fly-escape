# Help the Fly Escape — browser game

Status: **implementation active — physical scale, furnished rooms and two levels**. Last updated: 2026-09-08.

Build a local, fully 3D browser game in which the player places environmental objects and watches a real connectome-driven swarm attempt to escape. The [game contract](GAMEPLAY.md) owns user requirements; [architecture contracts](CONTRACTS.md) own runtime/data seams. This plan replaces the previous Python tech-demo scope.

## Next Agent Prompt

**Current objective:** finish playable mechanics and balance exactly two levels. Visuals are accepted for MVP. Campaigns are timed (start at five simulated minutes, maximum ten); feeding, energy extension and starvation are deferred. A round ends at the timer or when all flies escape. Food retains odor and physical landing/walking. Three stars should be difficult, targeting roughly10% of players through playtesting; a separate all-escaped Perfect tier remains conditional on attainability. See [GAMEPLAY](GAMEPLAY.md).

**Shipped foundation:** timed policy and two replay modes are integrated. Fast fits the authored horizon into one minute after buffering; Real time remains available. Source-oriented neural delivery is integrated at518b184 with exact arithmetic preserved. The latest matched second-house scheduling capture started in18.415seconds with zero underruns; final balance and sustained release acceptance remain open. Production initialization and random streams remain unchanged. Do not resume old finite-energy warmup/feeding work or cosmetic refinements.

**Latest presentation:** `a136a8a` integrates a compact roster with exact world-pose previews and one selected details section, gentle zoom compensation, wall-shell transparency and scripted escape departures. [Evidence and limitations](assets/evidence/31/README.md) includes native contact sampling, camera/selection, screenshots and exact pause/reverse seeking. Walking wings are stationary. A bounded departure tail lets the last escape finish after the recorded horizon; hiding the page suspends its clock. The current presentation is accepted for MVP; do not resume art polish.

**Current pickup:** user clarified that biological fidelity precedes game design. Vinegar is not a generic fruit-fly repeller: low-concentration apple cider vinegar attracts real Drosophila; concentration and state matter. The current Vinegar → RepellentOdor → inhibitory LH input binding is an assumption, not a validated chemical receptor model. Inhibitory signaling is not synonymous with behavioral avoidance. Audit the sensory binding against primary evidence before further object tuning; see [biological grounding](assets/evidence/32/food-strategy/biology.md). The food-strategy runs establish behavior of the current model, not biological validation. The ten-minute diagnostic has completed with no route-food advantage; all old probe jobs are terminal. Independent audits are complete and source annotation joins are banked in the biological report. The [anatomical readout correction](assets/evidence/32/readout-anatomy/README.md) is integrated and the regenerated data is served: full-source export, graph tests and browser neural integration checks pass. Earlier probe/review jobs are terminal. The next seam is [biological sensory grounding](slices/33-biological-sensory-grounding.md). The [DA2 feasibility pulse](assets/evidence/33/da2-pulse/README.md) completed and root reproduced all neural observations. It retained the sensory population and demonstrated relay activation under an uncalibrated bilateral pulse; it does not prove avoidance or chemical encoding. All related jobs are terminal. [Protocol-specific electrical response data](assets/evidence/33/geosmin-encoding/README.md) is now extracted and checked against the source figure. Next define an experiment-local timebase and input representation that matches those evoked rates, exposing assumptions before runtime adoption. The timing audit confirms the existing game neural step is deliberately abstract, not mislabeled milliseconds. Preserve the negative DM1 evidence. Do not use old balance reports as validation of the corrected model.

**Priority order:** validate the biological meaning of sensory inputs, then craft two playable levels around supported effects, testing clock/layout changes within the ten-minute playable limit, then freeze setups and thresholds for tuning and holdout. Short-range exit suction is shipped at5b3de25 and stays identical across comparisons, restricted to the exit room. A single fan may be tested as a counter to distractions, but must not replace fan-free controls. Vinegar remains an unproven counter; do not launch a neural redesign or represent it as solved. Holdout remains untouched. No feeding/life-extension change is needed.

**Evidence ledger:**
- [Mechanical integration](assets/evidence/30/integrated-playtest/README.md), [moving chamber](assets/evidence/30/spike-steering/README.md), [full-body responses](assets/evidence/30/spike-body/README.md): current source binding and firing readout are integrated. Weak/asymmetric inhibition is acceptable; no further neural-gain sweep. Old-layout placement results are not new-maze balance evidence.
- [Presentation/contact](assets/evidence/31/README.md): walking wings, shared selection/preview poses, zoom and contact evidence. The six-fixture WASM/archive round-trip completed and root reran it (`/tmp/fly-contact-roundtrip/report.md`); broader contact/visual acceptance remains open.
- [Task yielding](assets/evidence/17/task-yield/README.md): scheduling improved measured startup without changing arithmetic. Sustained performance is still red: `/tmp/fly-release-panel` stopped on its first frame-p95 failure. Actual Safari has placement/play/pause smoke only; automated WebKit is not full Safari acceptance.
- [Current maze duration](assets/evidence/32/maze-duration/README.md): browser five/ten-minute pair is complete. Old continuous controls and fan arrangements are superseded by the fan-free comparisons above. Do not label the old arrangement a successful guide.

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
- [x] [21 — Recognizable household shapes](slices/21-house-shapes.md) — dependencies: 19,20.
- [x] [22 — Natural authored materials](slices/22-house-surfaces.md) — includes a finite circular grass exterior and bounded rendering; dependencies: 21.
- [x] [23 — Daylight and household illumination](slices/23-house-illumination.md) — dependencies: 22.
- [x] [24 — Follow visibility in a furnished room](slices/24-furnished-readability.md) — dependencies: 23,18.
- [ ] [33 — Biological sensory grounding](slices/33-biological-sensory-grounding.md) — user clarification; required before final object and campaign acceptance.
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

Remaining empirical gates are campaign reliability, useful placement effects in both houses, followed by final-build performance and platform coverage. Accepted component evidence stays with its owning slice; a newly measured regression reopens that contract explicitly.
