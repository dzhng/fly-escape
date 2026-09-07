# Time-resolved turning readouts

DM1 stimulation reaches existing turning-readout neurons, but this observation does not establish a reproducible directional pattern that the decoder cancels. It also cannot establish that directional information is absent. No runtime, graph, dynamics, gain, neuron selection or motor mapping changed.

The fixed internal split uses original seeds 0–14 for discovery and 15–29 for held-out comparison, all 50 existing turning neurons and all 100 ticks. These 30 seeds had already been examined in aggregate; the split is not a new independent confirmatory experiment. The predeclared directional contrast is each neuron's matched active-minus-control response for source +Z minus that for source −Z. No neurons or time windows were chosen after viewing responses.

| Measurement | Discovery/held-out cosine | Descriptive one-sided sign-flip p |
|---|---:|---:|
| Time-resolved directional voltage pattern | 0.180 | 0.0764 |
| Projection onto existing turn decoder | −0.140 | 0.8220 |
| Residual orthogonal to turn decoder | 0.185 | 0.0728 |
| Time-averaged directional neuron pattern | 0.213 | 0.1137 |
| Directional spike pattern (secondary) | −0.032 | 0.7051 |

Only 8/15 held-out seeds contribute positively to the primary discovery-template dot product. The held-out mean decoder directional contrast is 0.000199, with descriptive t(14) interval [−0.001253, 0.001652]. There is no persuasive evidence here of a stable directional response merely hidden by temporal averaging or the fixed left/right population average.

Each source's active-minus-control voltage pattern is more reproducible separately (cosines 0.314 and 0.335; descriptive p=0.0000916 and 0.00168). This supports stimulus-related readout activity under either source condition; it is not evidence that the two source directions are reliably distinguished. Their sign flips exchange active/control labels, whereas the directional test exchanges mirrored source labels within paired effects.

All p-values exhaust the 2^15 held-out seed sign assignments against the fixed discovery template. They are **descriptive symmetry tests assuming seed-vector sign exchangeability**, not exact randomized-assignment inference. Secondary decompositions, spikes and source-arm checks are not multiplicity-adjusted. Large residual norms can contain noise; they do not prove that a different decoder would recover useful steering. Post-update voltages include spike resets, so voltage changes alone are not firing-rate changes.

## Preservation and scope

The same historical core, gain 2, cold initialization, anatomical antenna spacing, 100 field-settle ticks, sources, weights and mappings reproduce all 3,986 historical output leaves exactly, excluding elapsed time. The run took about 19 seconds after compilation. Every one of 12,000 unique (seed, source, active/control, tick) tuples is present, with no duplicates or missing samples and exactly the expected 68 entries (50 turning plus 18 flight observations).

The Rust probe reconstructs turn as mean(right turning voltage) minus mean(left turning voltage), and flightTurn as that value plus half the flight-population difference. Both agree exactly at every tick. Offline analysis independently verifies those values with ordered floating-point accumulation. An initial Python check using built-in `sum` failed at the first frame because this Python uses compensated summation; explicit ordered accumulation preserves the existing Rust decoder and passes exactly. No numeric tolerance was introduced to conceal that mismatch.

This remains a **Chamber** observation: shared `body::desired_pose` and a planar geometry sweep, not campaign `BodyState` support/contact motion. Free movement changes later sensory histories. The result locates stimulus-related activity at the fixed readouts without proving biological direction coding, attraction, a decoder defect or campaign behavior.

## Reproduction and recommendation

`probe.rs` preserves the scratch observation extension; its paths identify the historical core/input and scratch outputs. `trace.json.gz` records all neuron voltages/spikes and motor values; `evidence.json.gz` preserves the unchanged aggregate output. `analysis.json` contains coverage, input hashes and numerical results. Run `python analyze.py` with NumPy available from this directory to recompute the analysis against the parent transmission archive and manifest. It asserts coverage and exact decoder/historical identity before interpreting patterns. The raw trace is approximately 7 MiB compressed; no runtime data format changed.

Retain the negative attraction conclusion and the pending architecture decision. This bounded pass supports neither choosing different neurons/weights nor further gain tuning. A claim of recovered directional control would require new, independently held-out conditions and a separately authorized model decision.

Root integration reruns the offline analysis successfully with identical results. Independent review confirms the trace coverage, projection algebra and observation-only source diff; its inferential qualifications are incorporated above.
