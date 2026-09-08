# Bounded repellent-object experiment

Geosmin-associated mold is a biologically motivated candidate, but these moving-fly tests do **not establish useful, consistent repulsion**. Small and variable effects remain observable. This is not evidence that repulsion is impossible, that the decoder alone is defective, or that the candidate must be removed from exploratory play. Repulsion is optional; the game should proceed around aggregate placement effects without another open-ended neural investigation.

## Biological basis and scope

[Stensmyr et al. (2012)](https://pubmed.ncbi.nlm.nih.gov/23217715/) identifies geosmin-sensitive Or56a receptors and the DA2 avoidance circuit in real fruit flies. A moldy object representing geosmin emission is a game abstraction: not all mold has this odor, and the model does not reproduce its full chemical mixture. [Citronellal also has fruit-fly avoidance evidence](https://pubmed.ncbi.nlm.nih.gov/20797863/), but requires a less direct mapping into the available source annotations. The often-cited Ir40a/DEET receptor claim was [retracted](https://www.nature.com/articles/nature18613/); it was not used as an alternative wiring rule.

## Moving chamber

The scratch probe uses the retained [DA2 graph](../da2-pulse/README.md), production fields, neural dynamics and the existing walking chamber. Sixty independent neural random streams (20 flies × three root seeds), sixteen conditions and sixty simulated seconds per condition give 960 trajectories. They share one starting pose and heading; these are not 960 independent layout tests or campaign playtests.

A source sits beside the start or on the observed control path, with each location reflected across the z axis. The on-path placement was chosen after the initial control showed no close encounters. Each comparison uses the same random stream and measures distance and time within the source's 0.75-metre disk. **That disk is not the extent of the diffused odor plume.** Flies sense odor outside it. The chamber uses its widened 0.15-metre antenna offset, unlike the anatomical spacing in the campaign.

Local field values, clipped to [0,1], scale current on the same-side DA2 receptors. Motor readouts are excluded, unknown-side receptors are omitted, and there is no fan or repulsion force. The two smaller amplitudes come from the earlier [isolated input fit](../geosmin-encoding/README.md); the larger is an existing strong-pulse comparison. Here they are phenomenological amplitudes, **not calibrated airborne doses or verified physiological firing rates**. The chamber retains the game's abstract neural clock. A negative strong-amplitude result cannot rule out inadequate encoding.

The raw treatment labels `Left` and `Right` mean positive-z and negative-z placements respectively. They are reversed relative to the chamber's anatomical left/right convention at heading zero. The stimulus-to-receptor wiring itself follows the field sampler's correct side convention. Preserve these raw identifiers for reproduction; interpret positions by coordinates.

At the on-path site, the higher fitted amplitude changes near-object residence by +0.00347 of the run (paired standard error 0.00499). Its mirrored site changes it by −0.00247 (0.00305). The strong amplitude gives −0.00383 and +0.00158 respectively. This does not demonstrate consistently reduced residence. Some other exploratory contrasts exceed two standard errors; the statement that every effect is within one standard error is incorrect. No multiple-comparison claim or exact-zero claim is made. All paired distance/residence summaries are in [the independently calculated summary](chamber-summary.json).

## Reproduction and review

The banked probe and adapter diff are scratch evidence, not production changes. Apply the diff to the pre-experiment simulation and place the example under `crates/sim/examples/`; run `cargo run --release -p sim --example da2_repellent_object -- GRAPH_DIR OUTPUT_DIR 600`. The graph directory also needs the DA2 group file from the graph-retention evidence. Raw observations are in `chamber-results.json.gz`. Root reran the compiled probe and all 960 trajectories and reported metrics reproduced exactly, excluding elapsed time.

Independent code review found reporting errors about calibration, statistical uncertainty, source-disk versus plume exposure, lateral labels and causal localization. All are accepted and corrected in this report. The unreviewed Claude narrative is not the evidence contract. In particular, neither these tests nor the earlier food experiments support saying that fans are the only effective objects.

## Five-minute authored-house comparison

A separate native `Attempt` comparison uses the actual first-house geometry, distant mixed walking/flying spawn, twenty flies, environmental objects and unchanged short-range exit suction. There is no fan. Both arms contain the same placed physical proxy at (6.45,6.35); the existing vinegar object supplies its geometry and scalar odor field **only as scratch plumbing**, not a claim about vinegar chemistry. The DA2-retention graph's `odorInhL/R` groups are replaced with the annotated same-side DA2 receptors. The control sets this pathway's gain to zero; the active condition uses 0.08203125. Other inputs, graph, seeds and objects are identical. This isolates the added receptor signal without removing an obstacle in the control.

Unlike the graded chamber adapter, this comparison retains the game's existing binary local-contrast detector and anatomical antenna spacing. The two experiments therefore test different explicit encodings; they are not pooled as one treatment. The amplitude is not a physiological dose.

| Root seed | Escapes: control → active | Seconds within 0.9 m per fly: control → active | Mean distance in metres: control → active |
| --- | --- | --- | --- |
| 15789670027162723101 | 1 → 1 | 23.910 → 23.970 | 2.811 → 2.989 |
| 104 | 1 → 1 | 8.730 → 6.045 | 3.276 → 3.168 |
| 106 | 1 → 0 | 9.925 → 8.565 | 3.318 → 3.100 |

Near-object residence decreases in two seeds, but mean distance also decreases in those seeds; these measures do not demonstrate consistent local avoidance. Identical escape counts in two seeds do not mean trajectories are identical. This is a small exploratory comparison, not a population estimate or accepted level balance.

The [existing duration probe](../../32/food-strategy/probe.rs) is reused without changing its runtime behavior. Its scratch maximum horizon is 36,000 ticks rather than the production 6,000; all these runs use 3,000. Reconstruct the scratch manifest by replacing the two matching groups using `maze-sensory-groups.json` in the DA2-retention manifest. The original group-link summaries are unused by the native simulation and are not a valid browser visualization of this scratch binding. Then run the duration probe with `GRAPH_DIR maze-active.json 3000 OUTPUT_JSON all reference` and the corresponding control content. The configuration files, raw result archives and independently computed summary are banked here; the graph identity and simulator build identity are recorded in each result.

The final house comparison uses amplitude 2.0, the existing game stimulus magnitude and earlier strong-pulse amplitude, without changing the circuit or decoder. It produces escapes [1,2,0] versus control [1,1,1]. This redistributes success across seeds rather than establishing an aggregate improvement. Its source-distance and residence results remain mixed (see `maze-summary.json`). Across the nine house attempts, each runs twenty flies for five simulated minutes. The search ended within its thirty-minute budget; no experiment remains live and no runtime repeller is advertised as validated.
