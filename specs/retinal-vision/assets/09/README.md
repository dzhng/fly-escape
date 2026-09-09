# Frozen chromatic downstream experiment

**The color panel does not pass its frozen gate.** At the lower intensity, one downstream membrane-voltage endpoint passes held-out correction; at the doubled intensity, none passes. Neither contrast has a corrected spike-count endpoint. This is not grayscale completion or evidence of biological color fidelity.

The [preregistration](preregistration.md) freezes the source-informed Tm2 brightness/Tm20 blue proxy, gain 3, both supported color patterns, all exclusions and the voltage-primary/spike-secondary ordering before experimental Brain execution. The [six-seed result](diagnostic/evidence.json) and [thirty-seed held-out result](confirmation/evidence.json) preserve the failures. Both panels use the same 438 endpoints, with all 1,176 input cells and every motor/readout excluded; full per-seed spike counts cover 40,944 reachable downstream cells.

| Held-out matched-dose color contrast | Corrected voltage cells | Corrected spike-count cells | Downstream cells with different aggregated spike counts |
| --- | ---: | ---: | ---: |
| A/B spatial swap | 1 | 0 | 62 |
| Exact integer-doubled A/B swap | 0 | 0 | 134 |

The final column is descriptive propagation across seeds, not a substitute statistical gate. Different aggregate counts can arise in different cells or directions across seeds. The two voltage/spike measures share 1,752 Bonferroni comparisons; held-out critical t is 4.9576042 and the voltage floor is ±1e-9 model units.

RGB8 A=[100,100,100] and B=[35,117,123] are swapped across the same jointly supported sites in both eyes. The second level doubles every byte. Actual native diagnostic luminance and all Tm2 currents are exactly equal between swaps. Per-eye/channel dose differences are at most 2.22e-16, below the preregistered 1e-9 tolerance. Both total visual doses match, so a globally stronger blue drive cannot explain the primary contrast. Uniform A/B fields deliberately change blue dose and remain diagnostic conditions only.

All exact repeats, all-input-silenced comparisons and chromatic-off comparisons pass. With Tm20 off, full downstream voltage/spike/refractory trajectories are identical between swaps. Grayscale variants, fixed within-eye/channel row permutations and every original/swapped condition remain in the reports. No injected-cell difference is counted as downstream evidence, and no preferred motor output was selected.

Both color swaps change 22 injected cells. Doubling RGB raises each pattern’s total dose from 3.32104518 to 4.57443316 model units, while the actual A/B current-difference L1 falls from 0.17283443 to 0.16104509 (maximum per-cell difference 0.03240646 to 0.03019595). These are descriptive adapter measurements, not a revised gate. The ordinary higher intensity does not guarantee a stronger chromatic contrast: the frozen `q/(q+0.5)` transfer saturates. [The evidence tables](confirmation/evidence.json) report actual per-cell differences and total doses. A future reslice could preregister equal adapter-level chromatic contrast over supported intensity levels, or assess a broader independently specified downstream population statistic. It could also test larger equal-supported patch areas within the existing budget. Those are future hypotheses requiring fresh evidence, not retroactive explanations that make this panel pass. Changing coefficients, gains, axes or physiological assignments after these outcomes is not justified.

The [shared experiment instructions](../08/README.md) describe source bindings, exact byte files, native execution, analysis and lossless storage. Use `../08/inputs-09.json` or `../08/confirmation-inputs-09.json` with the native probe. The complete browser capture/transaction/record chain and further controlled neural proof remain open. Graph and manifest bytes are unchanged.

[Verification, execution resources, visual limitations and decision audit](../08/verification.md) accompany the frozen results.
