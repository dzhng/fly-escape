# Offline connectome preparation

This pipeline is the browser graph's sole data owner. It preserves signed seed-touching extraction, makes selection stable, and exports incoming-current CSR plus source-defined pathways. The runtime never needs raw Feathers or Python.

Ordinary builds use the committed `data/processed/brain/graph.bin` and `manifest.json`; no Python environment or raw dataset is needed. Regenerate them when changing the source data or extraction logic, and commit the graph and manifest together. The build checks that the binary matches its manifest hash.

For regeneration or offline reference tests, install Python and uv, then run from the repository root:

```sh
uv venv .venv
uv pip install --python .venv/bin/python -r scripts/requirements.txt
.venv/bin/python scripts/prepare-graph.py --download --verify-reference
```

Regeneration downloads roughly 1.1 GB of source data into ignored `data/raw`. The graph and manifest are tracked; inspection reports beside them remain ignored. A second run without `--download` verifies local source hashes before extracting. `--output` supports independent reproducibility comparisons.

The manifest identifies the dataset, actual source hashes/generations, exporter content hash, stable-selection correction, byte format and pathway memberships. Olfactory turning readout candidates are verified against the source annotations first: a candidate that is not a descending neuron on its named soma side fails the export by body ID instead of being dropped or relabelled. Brain group links summarize real selected edges, including overlapping groups; they are not a substitute for behavior probes. Unknown transmitter signs preserve the spike's positive fallback and are reported explicitly.

`--verify-reference` compares every selected body and signed edge against the spike with only selection ordering stabilized. The optional [faithful loader oracle](../reference/graph_loader.py) is retained under the reference owner; normal export remains independent of it. Agreement with the reference establishes extraction semantics, not biological validity of sensory inputs or behavior.

Run `.venv/bin/python -m unittest discover -s tests/connectome -v` for small synthetic extraction/format contracts. Their graphs are test inputs, never evidence of successful real-fly behavior.

## Visual inputs are metadata

The annotation-derived visual map lives inside the graph manifest. Its two display groups follow the mapped cells' source soma sides; they do not retain the former AOTU membership or claim retinal reconstruction. The [map exporter](vision_map.py) owns the modeled column registration and connectivity audit. Candidate JSON files are experiment evidence, never a second runtime data channel.

A metadata-only preparation reads the existing graph and verifies its hash plus the annotation source before updating the manifest and group connectivity. It does not read the full source weights, run extraction or rewrite graph bytes. Original extraction provenance is retained separately from the current metadata exporter identity.

Select an experimental family with `--vision-family`; after the pilot freezes its winner, the existing pathway registry's `visionFamily` becomes the default. Both export modes reject an absent choice until then. Use `--metadata-only` against an existing graph directory to publish that choice. A successful export contains the selected map alone; missing or empty sectors are errors, not permission to restore a binary AOTU adapter.

## Data attribution

The source is [Janelia FlyEM MaleCNS v1.0](https://male-cns.janelia.org/download/). The source project credits FlyEM at HHMI Janelia, the University of Cambridge, the MRC Laboratory of Molecular Biology and Google Research. Its download page identifies the dataset as [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

This project selects a subgraph and transforms connection weights into signed incoming currents. It is neither the complete nervous system nor recorded activity from a living fly. Prepared `manifest.json` records source identities, checksums, extraction rules and graph identity so a build can be traced to its inputs. Missing transmitter annotations use the documented fallback; model assumptions are not supplied by the connectivity data itself.

The dataset license does not assign a license to this repository's code or artwork. The game's [About page](../../apps/web/src/about.tsx) presents the same data attribution and modeling distinction to players.
