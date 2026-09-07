# Cold DM1 receptor substitution

No reliable approach candidate. DM1 receptor and projection-neuron spiking increased on both mirrored arms, but paired source-directed turn, alignment and distance effects all include zero. Do not promote this substitution or tune gain from this result.

Same cold-odor harness and sim revision 3671da3754f57cac91192dc19f22032fa1899d5d as prior probes, gain 2, 30 seeds, 100 ticks, 100 field-settle ticks, normal Brain initialization, anatomical antenna spacing, unchanged motor mappings and graph binary. Runtime 17.094 seconds. The 60 matched no-current runs exactly reproduce all 840 historical control values.

Scratch input groups:74 ORN_DM1 neurons,35 left / 39 right, selected by type and rootSide from checksum-recorded MaleCNS annotations. Both DM1_lPNs (one per side) are observation groups. Existing 16-group limit required replacing unused vision observation groups; no limit was widened. Body IDs, graph indices, source hashes and exact mutation are in provenance.json. Original groupLinks were cleared because they are derived metadata for the replaced groups.

|Source Z|Paired source-directed turn|Paired distance reduction (m)|Paired alignment|
|---|---|---|---|
|-1.0|-0.000889 [-0.001849, 0.000071]|-0.002915 [-0.021014, 0.015185]|-0.046465 [-0.105572, 0.012642]|
|1.0|0.000452 [-0.000707, 0.001610]|-0.000424 [-0.013275, 0.012427]|-0.027436 [-0.100619, 0.045747]|

Values are active minus same-seed no-current means with descriptive 95% t(29) intervals; no multiple-testing correction.

|Source Z|DM1 left spike fraction change|DM1 right|PN left|PN right|
|---|---|---|---|---|
|-1.0|0.447457 [0.424312, 0.470603]|0.002684 [-0.000476, 0.005844]|0.203667 [0.192993, 0.214341]|0.139333 [0.132404, 0.146263]|
|1.0|0.004886 [-0.003738, 0.013510]|0.431368 [0.403520, 0.459215]|0.197333 [0.185528, 0.209139]|0.228000 [0.212827, 0.243173]|

Spike fractions and post-update mean voltages are recorded per arm and seed; lower post-reset voltage must not be read as weaker firing. Both PNs increase spiking in all 30 seeds for both source sides, demonstrating propagation but not a usable steering response.

|Source Z|Active path length (m)|Active net displacement (m)|Active distance reduction (m)|
|---|---|---|---|
|-1.0|0.787394 [0.786534, 0.788253]|0.726449 [0.709939, 0.742958]|-0.185931 [-0.275928, -0.095934]|
|1.0|0.787334 [0.786465, 0.788203]|0.731662 [0.717277, 0.746047]|-0.250354 [-0.324524, -0.176183]|

The bodies keep moving (~.787m path), yet end farther from the source on average. This is not failure to excite the injected receptors. The experiment does not isolate where downstream direction information is lost and does not justify flipping motor signs.

Primary biological rationale: Semmelhack and Wang (2009), https://www.nature.com/articles/nature07983, supports testing DM1 receptor input. It does not calibrate this current gain, binary contrast detector, MaleCNS extraction or body decoder. The extraction retains only seed-touching edges, so success in a biological receptor-rescue experiment need not survive this graph/model. This is a diagnostic chamber result, not campaign acceptance.

Recommendation: keep this as a negative receptor-substitution result. If further investigation is authorized, inspect directional transmission from the measured DM1 PNs to existing turning readouts before considering any new perturbation; no additional sweep was run.

## Downstream transmission check

The same historical core, seeds and inputs were repeated with additional observation of the existing turning and flight groups; no graph, gains, inputs, dynamics or decoder changes. Independent review compared 2,946 prior leaf values excluding elapsed time; all match exactly. The neural, graph, chamber and sensory implementation files are unchanged between the historical core and current root. `transmission.rs` and compressed `transmission.json.gz` preserve the additional measurements.

Although the DM1 projection neurons increase spiking, the turning groups' paired spike-fraction changes all have descriptive intervals spanning zero. Their mean-voltage shifts are small; one left-group interval excludes zero, but the paired left/right difference still lacks reliable source-directed steering. This additional measurement does not locate a specific failed synapse, establish a biologically correct decoder, or justify retuning.

Run `.venv/bin/python specs/help-the-fly-escape/assets/evidence/30/dm1-input/connectivity.py` from the repository root to print the graph check. `connectivity.py` reads the exact graph and probe groups; `connectivity.json` records directed reachability while deliberately ignoring signs and dynamics. Both DM1 projection neurons reach all 25 left and all 25 right turning readouts through two to four edges, with no direct edges. The problem is not complete topological disconnection. Reachability cannot establish effective neural transmission, so no missing-connection patch follows from this result.

The unresolved question is functional transmission and decoding after the measured odor relays. Further observation may localize it, but the pending user decision about the strict model versus a labeled simplified model remains unchanged. Do not count this evidence as attraction, a campaign gate, or authorization to replace neural control.
