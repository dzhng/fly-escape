# Voltage and firing respond differently to odor input

Fixed-input probe at b77198b: 30 matched seeds, five arms, 100 cold-brain ticks, gain two, real graph and production sensory current generation. No body integration or target steering. `probe.rs` is the executed harness; `raw.json.gz` preserves every arm and identity, and `summary.json` contains paired stimulus-minus-control means and descriptive t(29) intervals.

| Stimulated group | Walking turn delta | Flying turn delta | Left steering-group firing delta | Right steering-group firing delta |
| --- | ---: | ---: | ---: | ---: |
| Excitatory left | +.02612 | +.02684 | +.00825 | +.00096 |
| Excitatory right | −.01431 | −.01495 | +.00107 | +.00504 |
| Inhibitory left | −.00117 | −.00256 | −.00093 | −.00023 |
| Inhibitory right | +.00410 | +.00438 | −.00004 | −.00132 |

Positive turn points toward the right antenna under the measured body convention. Flying and walking do not reverse the odor response: the extra flight term's paired interval includes zero for each arm. The prior walking-only chamber limitation therefore does not explain the weak campaign attraction.

Excitatory input increases downstream firing while lowering average voltage on that side. Inhibitory input does the reverse, more weakly. The motor decoder currently reads voltage, which resets after firing. This supports investigating a firing-based steering readout; it does not prove a decoder defect, a causal explanation of campaign failure, or actual attraction. These are fixed-input results, not spatial behavior or validated biological response.

Raw identity fields comparing steering/flight group lists with pathway lists are false because their order differs. Their index sets are equal; the four groups contain 25/25/9/9 neurons. Do not interpret those flags as different readout membership. Sensory input excludes motor neurons, leaving ten left and nine right excitatory inputs and six inhibitory inputs on each side. That asymmetry is observed; its causal contribution is untested.
