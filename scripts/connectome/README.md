# Offline connectome preparation

This pipeline is the browser graph's sole data owner. It preserves signed seed-touching extraction, makes selection stable, and exports incoming-current CSR plus source-defined pathways. The runtime never needs raw Feathers or Python.

Create the local Python environment with `uv venv .venv`. Install the offline dependencies with `uv pip install --python .venv/bin/python -r scripts/requirements.txt`, then run `.venv/bin/python scripts/prepare-graph.py --download --verify-reference` from the repository root. Sources go into ignored `data/raw`; prepared artifacts and the inspection report go into ignored `data/processed/brain`. A second run without `--download` verifies local source hashes before extracting. `--output` supports independent reproducibility comparisons.

The manifest identifies the dataset, actual source hashes/generations, exporter content hash, stable-selection correction, byte format and pathway memberships. Brain group links summarize real selected edges, including overlapping groups; they are not a substitute for behavior probes. Unknown transmitter signs preserve the spike's positive fallback and are reported explicitly.

`--verify-reference` compares every selected body and signed edge against the spike with only selection ordering stabilized. The optional [faithful loader oracle](../reference/graph_loader.py) is retained under the reference owner; normal export remains independent of it. Do not promote spike biological claims into tooltip facts without the sensory/ablation gates.

Run `.venv/bin/python -m unittest discover -s tests/connectome -v` for small synthetic extraction/format contracts. Their graphs are test inputs, never evidence of successful real-fly behavior.
