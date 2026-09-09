# Version-2 execution boundary

Both v2 panels completed once on final cutover revision `030a86e8`; the color panel passed and the spatial/brightness/occlusion panel failed. [Results](results.md) preserve the primary/secondary distinction. [Freeze verification](freeze-verification.json) records their hashes, final manifest identity, exact accepted currents/populations and all passing controls. The authorized CPU window was used once for each frozen panel; no rerun is authorized. The preparation and freeze commands below document the completed steps and must not be repeated into these write-once directories.

The first command prepares bound packs and copies accepted input evidence. It refuses a legacy manifest before writing an output directory:

```sh
python3 specs/retinal-vision/assets/08-reslice/prepare_run.py \
  data/processed/brain specs/retinal-vision/assets/08-reslice/prepared-v2
```

After that preparation and clearance, freeze each panel separately. These commands verify all accepted currents and populations under the new runtime but do not construct a Brain:

```sh
cargo run --release -p sim --example retinal_neural_probe -- freeze \
  data/processed/brain specs/retinal-vision/assets/05 \
  specs/retinal-vision/assets/08-reslice/prepared-v2/inputs-08-v2.json \
  specs/retinal-vision/assets/08-reslice/confirmation-08-v2
cargo run --release -p sim --example retinal_neural_probe -- freeze \
  data/processed/brain specs/retinal-vision/assets/05 \
  specs/retinal-vision/assets/08-reslice/prepared-v2/inputs-09-v2.json \
  specs/retinal-vision/assets/08-reslice/confirmation-09-v2
```

Actual neural execution is a separate `run` action with the same arguments, only in the clear CPU window. Analyze with the existing `assets/08/analyze.py`, which explicitly dispatches v1 versus v2 protocol identities. Its statistical owner and neural measurement code remain unchanged. V1 artifacts remain reproducible with their historical source; current source identity checks intentionally do not bypass old freezes.

Validation before the authorized freezes: the example compiled, all three probe unit tests passed, and removing legacy-field rejection made the cutover test fail before restoration. The analyzer rejected mixed protocol/version identities. The pack preparer stopped on the current legacy manifest and created no output directory. Independent read-only review found no actionable findings in protocol separation, cutover guards, accepted input/current/population bindings or unchanged neural/statistical logic. No successful pack preparation, freeze, Brain construction or neural step occurred during these checks.

The authorized freeze commands completed with 37 spatial/brightness/occlusion conditions and 24 color conditions. Both retained all 438 endpoints, 1,176 injected cells, 1,696 motor/readout exclusions and 40,944 downstream cells. Graph/map/current-fixture bytes and the LIF source hash match the original evidence. Every accepted native current vector is exactly unchanged after the metadata/runtime cutover. At the freeze checkpoint both directories contained only `freeze.json`. They now also retain their started marker, lossless report/analysis archives and final figures.
