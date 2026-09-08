# Does the banana scent repel?

This bounded comparison finds a local attraction/retention bias through the production sensory mapping, not evidence of repulsion. It does not prove that a banana placement improves escape through the house.

The scratch chamber starts72 cold neural streams with randomized headings at one point,0.6m from a source, and repeats the matched no-source/source comparison at mirrored positions. Fields settle for30 simulated seconds before the flies start; the source, antenna geometry, field transport, neural graph, gains and body rules match production. Physical banana, taste, competing cues, wind and suction are absent. A distant opening required by BodyWorld has no cue or suction; no run terminates early.

| Source minus matched no-source control | One side | Mirrored side |
| --- | --- | --- |
| Distance from source after5s | −0.261m | −0.294m |
| Heading alignment with source after5s | +0.223 | +0.261 |
| Fraction of40s spent within0.75m | +0.049 | +0.043 |

Heading alignment is cosine of bearing error. The five-second window cannot reach a boundary: even the body's maximum clamped thrust permits only2.4m of travel with walls6m away. Longer measurements are boundary-influenced and carry less explanatory weight. The same streams serve both mirrored comparisons; they are not144 independent brains.

All conditions move farther from the source on average. Scent reduces that departure and biases orientation; it does not capture every fly or reliably bring the swarm to the source. Input detection occurs on roughly60–63% of early ticks in the source arms and never in controls. The source is already nearby and established, so this does not test distant recruitment through doorways.

The field profile also exposes a limitation of the modeled detector. In the sampled heading/profile, high concentration near the source can fail the relative left/right contrast threshold. A zero current there does not mean an absence of odor. This is a documented encoding assumption, not biological evidence, and was not retuned for this experiment.

Root reproduced the first output exactly except runtime. Review corrected a reversed diagnostic side-label comparison, final-position bookkeeping, and a terminal flag that had counted the normal horizon as early termination. The corrected run preserves the reported early metrics exactly. The banked source and results include those corrections. SHA256 input files are recorded separately.

To reproduce, copy `probe.rs` into a scratch checkout's `crates/sim/examples/banana_direction.rs`, build it with `cargo build --release -p sim --example banana_direction`, then run the executable with arguments: production brain directory, output directory, `400 0.6 300`. No production source change is required.

The house comparison still needs a causal explanation beyond score: the entrance banana produced25 exit-room visitors versus24 without added objects, but9 escapes versus14, and no recorded food support. These facts exclude blaming that sample on demonstrated food landing/feeding and do not establish repulsion. Attraction to an unhelpful location is a plausible explanation, not a proved decomposition of the lost escapes. Preserve existing neural signs and test level/object arrangements against empty controls.
