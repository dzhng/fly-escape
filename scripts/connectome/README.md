# Offline connectome preparation

This pipeline is the browser graph's sole data owner. It preserves signed seed-touching extraction, makes selection stable, and exports incoming-current CSR plus source-defined pathways. The runtime never needs raw Feathers or Python.

After the [initial checkout setup](../../README.md#run-locally), run `.venv/bin/python scripts/prepare-graph.py --download --verify-reference` from the repository root. Sources go into ignored `data/raw`; prepared artifacts and the inspection report go into ignored `data/processed/brain`. A second run without `--download` verifies local source hashes before extracting. `--output` supports independent reproducibility comparisons.

The manifest identifies the dataset, actual source hashes/generations, exporter content hash, stable-selection correction, byte format and pathway memberships. Olfactory turning readout candidates are verified against the source annotations first: a candidate that is not a descending neuron on its named soma side fails the export by body ID instead of being dropped or relabelled. Brain group links summarize real selected edges, including overlapping groups; they are not a substitute for behavior probes. Unknown transmitter signs preserve the spike's positive fallback and are reported explicitly.

`--verify-reference` compares every selected body and signed edge against the spike with only selection ordering stabilized. The optional [faithful loader oracle](../reference/graph_loader.py) is retained under the reference owner; normal export remains independent of it. Agreement with the reference establishes extraction semantics, not biological validity of sensory inputs or behavior.

Run `.venv/bin/python -m unittest discover -s tests/connectome -v` for small synthetic extraction/format contracts. Their graphs are test inputs, never evidence of successful real-fly behavior.

## Data attribution

The source is [Janelia FlyEM MaleCNS v1.0](https://male-cns.janelia.org/download/). The source project credits FlyEM at HHMI Janelia, the University of Cambridge, the MRC Laboratory of Molecular Biology and Google Research. Its download page identifies the dataset as [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

This project selects a subgraph and transforms connection weights into signed incoming currents. It is neither the complete nervous system nor recorded activity from a living fly. Prepared `manifest.json` records source identities, checksums, extraction rules and graph identity so a build can be traced to its inputs. Missing transmitter annotations use the documented fallback; model assumptions are not supplied by the connectivity data itself.

The dataset license does not assign a license to this repository's code or artwork. The game's [About page](../../apps/web/src/about.tsx) presents the same data attribution and modeling distinction to players.
