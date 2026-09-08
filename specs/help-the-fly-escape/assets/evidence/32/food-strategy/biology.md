# Biological grounding before puzzle tuning

The user clarified that the simulation should determine the game mechanics. A weak response is not automatically a defect; nor is an unexpected response automatically biological realism. The bridge from a named household object to neural stimulation must be supported before making either claim.

[Semmelhack and Wang (2009)](https://www.nature.com/articles/nature07983) found robust attraction to low-concentration apple cider vinegar, involving DM1 and VA2 olfactory glomeruli. Higher concentrations recruited DM5 and reduced attraction. This does not support treating unspecified vinegar as a universal repeller.

[Devineni et al. (2019)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6579511/) found opposing hunger-dependent responses to acetic-acid taste. Taste/contact responses must not be substituted for airborne odor avoidance.

[Stensmyr et al. (2012)](https://pubmed.ncbi.nlm.nih.gov/23217715/) demonstrated geosmin avoidance through Or56a sensory neurons and DA2. This is a candidate for a biologically grounded aversive stimulus, not authorization to rename the existing inhibitory input or assume that its downstream circuit is adequately represented.

The production catalog in `crates/sim/src/placement.rs` assigns vinegar to RepellentOdor; `crates/sim/src/sensory.rs` injects that cue into odorInhL/R. Those groups come from INHIBITORY_LH_MOTOR in the graph exporter. This bypasses chemical-specific receptor encoding. The sensory module itself labels these bindings as assumptions. Real measured connectivity plus modeled currents and motor decoding is a connectome-based simulation, not a complete validated reconstruction of the animal.

Next work should establish what the existing input groups biologically represent and whether the graph/data can support a small evidence-backed sensory mapping. Do not strengthen, reverse or relabel a pathway solely to make repulsion appear. Keep already authorized physical exit assistance explicitly separate from claims about neural behavior.

## Dataset feasibility check

Exact type matching against the local male-CNS annotations and current manifest body IDs gives:

| Circuit | Sensory neurons in source / retained | Projection neurons in source / retained |
| --- | --- | --- |
| DM1 | 74 / 74 | 2 / 2 |
| VA2 | 83 / 1 | 2 / 2 |
| DM5 | 35 / 35 | 7 / 7 |
| DA2 | 48 / 1 | 10 / 10 |

These are annotation membership counts, not proof of circuit completeness or function. Match exact `ORN_<glomerulus>` types and `<glomerulus>_*PN`; case-insensitive substring searches also include unrelated optic-lobe Dm types and must not be used for this inventory.

The existing smell-injection IDs resolve to lateral-horn types (for example LHPV6j1 and LHAD1g1), rather than these olfactory sensory neurons. The exporter deliberately seeds a fruit-related subset and retains only seed-touching edges. Merely retaining projection neurons or adding a new label cannot establish a faithful receptor-to-motor pathway. The source annotations contain the missing sensory populations, so a bounded extraction/encoding spike is feasible without seeking a new dataset; whether the resulting dynamics reproduce the relevant published behavior remains an open test.

## Readout and prior-experiment check

The accompanying `input-annotations.json` records the annotation/transmitter join with graph and source identities. All twenty excitatory candidates have acetylcholine consensus labels; the twelve inhibitory candidates have GABA or glutamate labels, which the current exporter assigns negative signs. This confirms the exported sign convention, not behavioral aversion or universal biological effects of those transmitters.

The right olfactory descending-neuron list contains two annotation-classified central-brain intrinsic cells: body13500 (LHAV2p1) and body12212 (PVLP143). Body13500 is also an excitatory smell candidate and is excluded from sensory injection by the motor-readout guard. Consequently the effective excitatory input has ten left and nine right cells. Removing the guard would directly stimulate a measured output and is not an acceptable fix. The readout membership needs anatomical review before a new sensory experiment can be interpreted; correct its provenance rather than adding compensation for an assumed direction of behavior.

An earlier [DM1 receptor substitution](../../30/dm1-input/report.md) already demonstrated receptor and projection-neuron activation without reliable approach behavior. Its downstream checks did not establish that a simple decoder change would recover direction. Do not repeat the same substitution, rename the existing inhibitory channel as geosmin, or retune gains to manufacture a desired result. Resolve the anatomical readout inconsistencies and define the biological scope of the retained circuit first.
