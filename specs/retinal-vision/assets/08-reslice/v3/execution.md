# Spatial v3 execution handoff

Status: spatial pack and source freeze completed; **Brain execution remains
held pending separate root clearance**. The focused runner tests passed and the
release freeze verified all eleven controls, exact retained populations, and
accepted current vectors. The output contains only `freeze.json`; no started
marker or report exists. Seeds 300–329 are frozen, not executed.
[The verification record](freeze-verification.json) binds the completed freeze
and input pack; [the preregistration](preregistration.md) is the neural and
statistical contract.

The completed preparation used the existing owner with `--version 3`:

```sh
python3 specs/retinal-vision/assets/08-reslice/prepare_run.py \
  data/processed/brain specs/retinal-vision/assets/08-reslice/prepared-v3 --version 3
```

This created only the spatial pack and copied its bound artifacts. The existing
runner's focused checks and release freeze then completed with these commands:

```sh
cargo test -p sim --example retinal_neural_probe
cargo run --release -p sim --example retinal_neural_probe -- freeze \
  data/processed/brain specs/retinal-vision/assets/05 \
  specs/retinal-vision/assets/08-reslice/prepared-v3/inputs-08-v3.json \
  specs/retinal-vision/assets/08-reslice/confirmation-08-v3
```

Review the frozen seed, population, current and control bindings before the
separately cleared `run` action using the same arguments and output directory.
Keep the exact frozen sources and prepared bytes; do not rebuild against changed
source identities or replace any existing output.
Then use the existing [analyzer](../../08/analyze.py), evidence packager and
figure owner on the new output. No simulation or statistical loop is copied
into this directory. Earlier reports are never overwritten.
