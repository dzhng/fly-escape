# Feeding and landing feasibility

The current body decoder supports neural-gated feeding, but these probes **do not establish taste-driven feeding behavior**. Every taste gain produces the same feeding-start counts, mode occupancy, and final reserve as the matched zero-current baseline. Food remains a provisional cue pending a decoder/mapping decision; no threshold was adopted by this probe.

The [record](feeding-probe.json) contains graph provenance, source hashes, parameters, seed-level measurements, and one full readout trace per arm. The [native probe](../../../../../crates/sim/examples/feeding_probe.rs) uses the production Brain and Body owners. Thirty matched root seeds receive 60 unstimulated warmup ticks followed by 100 measured ticks. Positive taste current excludes all locomotion, landing, and proboscis readouts; none of the 19 taste indices overlap those readouts in this graph. Food geometry, initial reserve, and zero wind are held constant. The body receives each actual neural output at 0.1 game seconds per tick.

| Taste gain | Paired proboscis voltage change, 95% CI | Paired proboscis spike-fraction change, 95% CI |
| --- | --- | --- |
| 0.1 | −0.003104 [−0.006369, +0.000160] | +0.000417 [+0.000063, +0.000771] |
| 0.3 | −0.003364 [−0.008988, +0.002259] | +0.000333 [+0.000011, +0.000656] |
| 1 | −0.006707 [−0.011821, −0.001594] | +0.001000 [+0.000474, +0.001526] |
| 3 | −0.006657 [−0.011779, −0.001536] | +0.001000 [+0.000474, +0.001526] |

Intervals use paired seed means and Student t(29); this is a descriptive sweep without multiple-comparison correction. The small positive spiking change and negative voltage change are consistent with voltage resets after spikes. An increasing voltage threshold should not be assumed to detect stronger taste responses.

Baseline proboscis mean voltage is 0.719529 and exceeds the provisional 0.1 feeding threshold at every measured tick in every seed. Baseline landing-left/right means are 0.628615/0.648794; their average exceeds the provisional 0.2 landing threshold on 99.73% of measured ticks. Baseline flight thrust averages 1.313410 and exceeds its 0.2 takeoff threshold on every tick. These tonic values make raw thresholds poor selectors of stimulus-dependent action.

The existing takeoff rule also checks that landing activity is below threshold, so the feared continuous walking/flying alternation does not occur in this fixture. Across 3,000 measured body ticks, baseline has 2,110 walking, 4 flying, and 886 feeding ticks. Each taste gain has exactly the same per-seed mode totals, feeding-start counts, and final reserves. There are 31 feeding starts across the 30 baseline seeds. No hysteresis change is justified by this evidence alone.

Two controls preserve the causal boundary:

- Silencing proboscis neurons makes both their voltage and spike fraction exactly zero and produces zero feeding starts, even with gain-1 taste input and food contact.
- Silencing the taste neurons makes every gain-1 readout difference against the separately measured taste-ablated baseline exactly zero. Ablation's own baseline shift is retained in the record rather than subtracted against an intact baseline.

The measurements show a small transmitted taste response and a working motor requirement. They do not show a taste-selective feeding initiation policy or a useful landing control. Further mapping/decoder work needs a held-out comparison before level authors can rely on either. The fixture uses persistent broad food contact and does not test foraging or approach-to-food behavior.
