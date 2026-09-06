# Help the Fly Escape — browser game

Status: **implementation active — slice 05 buffered replay**. Last updated: 2026-09-07.

Build a local, fully 3D browser game in which the player places environmental tools and watches a real connectome-driven swarm attempt to escape. The [game contract](GAMEPLAY.md) owns user requirements; [architecture contracts](CONTRACTS.md) own runtime/data seams. This plan replaces the previous Python tech-demo scope.

## Next Agent Prompt

You are implementing the full browser game. Current pickup is [05 — buffered swarm replay](slices/05-swarm-playback.md): finish the ten uninterrupted full 1× runs before changing the simulation build. Memory and 100-fly capacity measurements are recorded; 100 flies remains below real-time and exceeds the full-duration archive cap. Keep the complete active-work fixture rather than counting terminal no-ops as production throughput.

Completed: [01 graph](assets/evidence/01/review.md), [02 neural browser](assets/evidence/02/review.md), [03 sensory environment](assets/evidence/03/review.md), [04 lifecycle](assets/evidence/04/review.md). The selected lifecycle seed demonstrates neural eating and starvation, not population foraging. Visual-cue closest-distance and campaign robustness remain empirical gates; loom/threat is unavailable.

Priority order: complete 05 sustained performance; resolve 06 overview marker clarity (close selection passes); finish 07 human/dependency acceptance after the [source-scale correction](assets/evidence/07/scale-review.md); verify integrated 08 animation with the current asset. In parallel, 13 science cards are finishing review in their worktree. Core mixed cues, local fans and placement metadata are isolated pending baseline completion and the heading-normalization fixes exposed by independent review. House modular assets are prepared, but 10 layout/renderer integration is still open. Nothing beyond 04 is a completed slice.

Evidence: [05 UI](assets/evidence/05/ui-review.md) and transport pass; [06 camera](assets/evidence/06/review.md) has one remaining overview marker issue; [07 workbench](assets/evidence/07/scale-review.md) has real-asset scale and stable replacement checks; [08 motion](assets/evidence/08/motion-review.md) is integrated, with final current-asset visual acceptance open. Runtime archive/time ownership is unchanged. Preserve one owner per concept and original gate dependencies when integrating prepared work.

Browser applications are under `apps/`, including `apps/web`. Neuroscience descriptions explain neurons and circuit activity, not game rules; controls have separate help. Preserve Python-parity LIF updates and the real graph. Reproduce ignored graph artifacts with the [exporter](../../scripts/connectome/README.md).

The user authorized replacing all spike code. Keep useful evidence/tooling, delete outdated code as consumers retire, and add no compatibility layer. CLI second-opinion review currently fails because the installed client cannot use its configured model; use an independent read-only agent review and record that limitation until the tool works.

Use the slice dependency graph below. Keep each change bounded to its contract; update the spec before an unlisted material choice or widening a slice. Run focused verification, record evidence and decisions, and update this prompt, statuses and global checklist before ending every implementation pass. Do not call placeholders final art or old Python reports browser proof.

## Global checklist and review map

Open the [interactive roadmap](visualizations/roadmap.html) for dependency and milestone navigation.

- [x] [01 — Reproducible graph and reference](slices/01-graph-reference.md) — dependencies: none.
- [x] [02 — One real brain in the browser](slices/02-neural-browser.md) — dependencies: 01.
- [x] [03 — One sensory environment](slices/03-sensory-fields.md) — dependencies: 02.
- [x] [04 — Finite life and physical escape](slices/04-lifecycle-outcomes.md) — dependencies: 03.
- [ ] [05 — Twenty flies with buffered replay](slices/05-swarm-playback.md) — dependencies: 04.
- [ ] [06 — Close framing and shared selection](slices/06-camera-selection.md) — dependencies: 05.
- [ ] [07 — Blender fly and replacement workbench](slices/07-fly-silhouette.md) — dependencies: 06.
- [ ] [08 — Playback-driven fly animation](slices/08-fly-motion.md) — dependencies: 07.
- [ ] [09 — Readable white trails](slices/09-fly-trails.md) — dependencies: 08.
- [ ] [10 — A readable 3D house](slices/10-house-geometry.md) — dependencies: 07.
- [ ] [11 — House materials and color](slices/11-house-palette.md) — dependencies: 07,10.
- [ ] [12 — Depth and exit lighting](slices/12-house-lighting.md) — dependencies: 11.
- [ ] [13 — All-fly science and explanations](slices/13-science-panel.md) — dependencies: 05,06.
- [ ] [14 — Editable setup and attempt loop](slices/14-placement-attempt.md) — dependencies: 05,06,10,13.
- [ ] [15 — Level 1 is the tutorial](slices/15-first-level.md) — dependencies: 03,04,09,12,14.
- [ ] [16 — Four more authored puzzles](slices/16-campaign.md) — dependencies: 15.
- [ ] [17 — Browser release and clean cutover](slices/17-static-release.md) — dependencies: 16.

## Standing gates and ownership

Every implementation pass preserves one owner per concept: graph/provenance in the exporter; neural dynamics, fields, geometry, body and results in their Rust modules; Worker transport/archive/playback in sim-client; projection/camera/assets in renderer; selected fly and UI attempt state in web. The panel consumes recorded values, the renderer consumes exported geometry, and no second simulation or pathfinding controller is allowed. Details and typed seams live in CONTRACTS.md.

The result should read as designed today, not as a web wrapper around the Python game. All existing code is disposable spike material: keep or adapt useful parts in their natural owners and delete outdated parts. Follow the [spike reuse policy](CONTRACTS.md#existing-spike-code). Keep Python only for offline graph preparation and focused reference fixtures that earn their place. The Worker reproduction spike is removed in 02; replaceable asymmetric model placeholders give way to Blender assets in 07 and 10; obsolete runtime paths/dependencies are removed as their useful consumers disappear, with a final audit in 17. No transitional compatibility owner survives release.

Every visual slice explicitly inherits [compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md) when it has a reference/prior look, using telemetry and a less-wrong verdict. It also runs an unprimed [screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md) as its last visual acceptance check. Each slice names one visual variable and crop/mask; unrelated visible wrongness belongs to another slice. Integration reviews combine only previously accepted variables.

Human shot reviews are non-blocking: use [preview-shots](../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while independent work continues, then make and record an evidence-based reversible decision if no response arrives and close the shots. This is not a new scope approval mechanism. Record failed probes as well as successful captures under the owning slice's `assets/evidence/NN/` folder.

Before closing a substantive pass, review ownership with [refactor-clean](../../.agents/skills/refactor-clean/SKILL.md), then the change with [code-review](../../.agents/skills/code-review/SKILL.md); keep docs focused on rationale and authoritative contracts. A failed scientific/performance gate blocks dependent content acceptance, not unrelated asset/harness work. Reslice measured problems; never quietly lower the 20-fly requirement, shrink the graph or add steering cheats.

## Evidence and remaining uncertainty

- [Science panel preparation](assets/evidence/13/review.md): all-card diagrams and bounded packed traces are prepared; integration and dependency acceptance remain open.

- [Research and reproduction](RESEARCH.md): actual source defects, reference architecture, primary external documentation and reproduction spikes.
- [Draft synthesis](assets/planning/synthesis.md): three independent approaches, tradeoffs and scrollback audit.
- [UI reference evidence](assets/ui/mock-review.md): mock limits; nearby images include approved framing and the rejected focus indicator.
- [Discovery map](BROWSER_GAME_MAP.md): historical interview record, superseded by this plan.
- [Planning validation](assets/planning/review.md): review results for this specification, not game acceptance.

The open empirical questions are explicit: source availability/extraction group coverage (01), correct neural port and observed movement (02), effective cue mappings (03), graph-driven feeding (04), sustainable 20-fly production (05), close asset readability (07–12), and puzzle robustness (15–16). Their slices name the experiment and verdict. Ordinary tuning is delegated there; these unknowns are not reasons to invent extra architecture up front.
