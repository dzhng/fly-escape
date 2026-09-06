# Offline runtime cleanup preparation

The retired Python game runners, visualization/arena/body modules, duplicate downloader and runtime requirements are removed. Historical evidence remains under artifacts and the spike archive. The five duplicated root history documents matched their canonical spike counterparts after the historical banner before removal.

Faithful LIF and graph-loader oracles now live under scripts/reference. Both source files are byte-identical to their prior src copies, so their source hashes are unchanged. Only the LIF fixture oracle path changed; every numerical field and its source hash stayed identical. Python preparation/reference consumers point to the new owner; no active src imports remain. NumPy, pandas, SciPy, PyArrow and tqdm remain offline dependencies, including tqdm used by the graph oracle.

Verification: five reference tests and five extraction/artifact tests pass. Full real-source preparation with --verify-reference reports all 70,000 neurons and all signed edges equal to the faithful loader. Its graph binary is byte-identical to the existing prepared graph. The exporter hash changes because its source now names the relocated oracle; it is provenance, not a neural behavior change. Browser code, renderer, gameplay, raw data and recorded evidence are untouched.

This is slice 17 cleanup preparation. Release build, campaign dependencies, ten production attempts and platform coverage remain open. No Preview was opened.
