# Version-2 execution boundary

Preparation is complete; no v2 pack, source freeze or neural run has been produced. The detached preparation checkout is based on `ed0564d5`. Integrate the final compact-budget/source-deletion cutover and obtain the root execution window before the commands below. The manifest-only intermediate cutover is not a reason to freeze while further relevant source edits remain in progress.

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

Validation during preparation: the example compiled, all three probe unit tests passed, and removing legacy-field rejection made the cutover test fail before restoration. The analyzer rejected mixed protocol/version identities. The pack preparer stopped on the current legacy manifest and created no output directory. Independent read-only review found no actionable findings in protocol separation, cutover guards, accepted input/current/population bindings or unchanged neural/statistical logic. No successful pack preparation, freeze, Brain construction or neural step occurred during these checks.
