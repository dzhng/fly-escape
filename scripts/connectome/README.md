# Offline connectome preparation

This pipeline is the browser graph's sole data owner. It preserves signed seed-touching extraction, makes selection stable, and exports incoming-current CSR plus source-defined pathways. The runtime never needs raw Feathers or Python.

Ordinary builds use the committed `data/processed/brain/graph.bin` and `manifest.json`; no Python environment or raw dataset is needed. Regenerate them when changing the source data or extraction logic, and commit the graph and manifest together. The build checks that the binary matches its manifest hash.

For regeneration or offline reference tests, install Python and uv, then run from the repository root:

```sh
uv venv .venv
uv pip install --python .venv/bin/python -r scripts/requirements.txt
.venv/bin/python scripts/prepare-graph.py --download --verify-reference
```

Regeneration downloads roughly 1.1 GB of source data into ignored `data/raw`. The graph and manifest are tracked; inspection reports beside them remain ignored. A second run without `--download` verifies local source hashes before extracting. `--output` supports independent reproducibility comparisons. Full preparation validates the committed retinal artifact by default; an explicit `--retinal-map` supplies another audited artifact. It publishes that artifact unchanged alongside the extracted graph only after the source budget and profile agree. A new graph therefore requires an explicitly audited budget and retinal map before publication.

The manifest identifies the dataset, actual source hashes/generations, exporter content hash, stable-selection correction, byte format and pathway memberships. Olfactory turning readout candidates are verified against the source annotations first: a candidate that is not a descending neuron on its named soma side fails the export by body ID instead of being dropped or relabelled. Brain group links summarize real selected edges, including overlapping groups; they are not a substitute for behavior probes. Unknown transmitter signs preserve the spike's positive fallback and are reported explicitly.

`--verify-reference` compares every selected body and signed edge against the spike with only selection ordering stabilized. The optional [faithful loader oracle](../reference/graph_loader.py) is retained under the reference owner; normal export remains independent of it. Agreement with the reference establishes extraction semantics, not biological validity of sensory inputs or behavior.

Run `.venv/bin/python -m unittest discover -s tests/connectome -v` for small synthetic extraction/format contracts. Their graphs are test inputs, never evidence of successful real-fly behavior.

## Source-bound retinal inputs

The [retinal exporter](retinal_map.py) maps both source-annotated Tm2 and Tm20 cells into the paired eye lattice. Its separate retinal artifact owns the spatial taps, color model and support masks. The manifest's two visual activity groups contain exactly those mapped cells, grouped by eye; no additional activity groups are introduced. Registration and visible-RGB responses are modeling assumptions, not retinal reconstruction.

The pathway registry owns a compact `retinalBudget`: the archived source-map hash, the graph and annotation identities that source belongs to, and its aggregate weight sum. Runtime retinal loading checks that identity and dose against the retinal artifact. A different graph requires a newly audited source budget; preparation cannot silently rename an old dose as belonging to new data. The full historical directional map remains archived evidence, outside the production manifest.

A metadata-only preparation reads the existing graph, retinal artifact and declared optical profile. It verifies the graph and annotation source before updating the manifest and group connectivity. It does not read full source weights, run extraction or rewrite graph or retinal bytes. Original extraction provenance stays separate from the metadata export identity. The retinal CLI requires explicit profile and color-model files; neither ordinary preparation nor retinal export selects a directional candidate.

Both color families share one aggregate dose. Each cell's spatial weights remain bounded, and unsupported retinal locations remain unsupported. These constraints limit modeled current; they do not establish turning or attraction.

## Data attribution

The source is [Janelia FlyEM MaleCNS v1.0](https://male-cns.janelia.org/download/). The source project credits FlyEM at HHMI Janelia, the University of Cambridge, the MRC Laboratory of Molecular Biology and Google Research. Its download page identifies the dataset as [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

This project selects a subgraph and transforms connection weights into signed incoming currents. It is neither the complete nervous system nor recorded activity from a living fly. Prepared `manifest.json` records source identities, checksums, extraction rules and graph identity so a build can be traced to its inputs. Missing transmitter annotations use the documented fallback; model assumptions are not supplied by the connectivity data itself.

The dataset license does not assign a license to this repository's code or artwork. The game's [About page](../../apps/web/src/about.tsx) presents the same data attribution and modeling distinction to players.
