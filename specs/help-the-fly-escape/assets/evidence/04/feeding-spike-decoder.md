# Spike-initiated body actions

The approved decoder uses emitted spike fractions for feeding and landing, while preserving voltage-based locomotion. A proboscis spike fraction above 0.2 starts a feeding bout when grounded on food. A bout remains active between pulses until contact loss, satiation, bout limit, or terminal outcome. A later bout requires the motor signal to re-arm. Landing averages the two landing groups' spike fractions against 0.2 and prevents another neural takeoff for one game second; the initial body has no dwell delay. These are provisional modeling choices, not inferred biological constants.

The [post-decoder record](feeding-probe-spike-decoder.json) retains source hashes, the exact body configuration, seed-level readouts, and mode/reserve measurements. It does not overwrite the [earlier voltage-decoder result](feeding-feasibility.md). Thirty matched seeds receive the same 60-tick warmup and 100-tick measurement window with either zero taste input, gain-1 taste input, or gain-1 taste with proboscis neurons silenced. Food geometry, initial reserve 5, and zero wind are fixed. Neural measurements remain independent of body feedback; after a body becomes terminal its state freezes and subsequent ticks are excluded from mode occupancy.

| Arm | Seeds that feed | Feeding starts | Walking / flying / feeding ticks | Starved | Mean final reserve |
| --- | --- | --- | --- | --- | --- |
| Baseline | 28 / 30 | 45 | 637 / 1,167 / 1,140 | 2 / 30 | 12.0360 |
| Taste, gain 1 | 27 / 30 | 45 | 676 / 1,120 / 1,121 | 3 / 30 | 11.9147 |
| Proboscis ablated, taste gain 1 | 0 / 30 | 0 | 988 / 1,387 / 0 | 30 / 30 | 0 |

Baseline proboscis spikes cross the new gate on 5.37% of neural ticks, and landing spikes cross their gate on 7.70%. Tonic voltage no longer triggers either discrete action. The proboscis-ablated arm has exactly zero proboscis voltage and spikes, no feeding, and eventual starvation in every seed.

These observations support neural initiation, landing, and latched feeding feasibility in the actual graph. They do **not** establish a taste benefit: the paired taste-minus-baseline final-reserve difference is −0.1213, with a descriptive Student t(29) 95% interval of [−1.3911, +1.1484]. Thirteen seeds improve, twelve worsen, and five are unchanged. The small positive proboscis-spiking response measured in the previous probe remains present, but this broad-food fixture does not demonstrate foraging or a survival advantage from taste.

Native fixtures verify that one emitted spike can start feeding, quiet ticks preserve the bout, tonic voltage without spikes cannot initiate feeding or landing, and another bout needs re-arming. Landing dwell is measured in game seconds at two step sizes; removing its gate makes the test fail. Existing contact-loss, cap, later-starvation, swept-exit, hazard, timeout, and score contracts remain green. The native library/tests and targeted clippy checks pass. A broader all-target command in the isolated checkout cannot compile the separately owned field probe because its root-only field modules are not committed there yet.
