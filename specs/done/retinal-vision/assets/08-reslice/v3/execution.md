# Spatial v3 execution handoff

Status: **the single spatial v3 run completed and failed the frozen primary
criterion**; see [the result](results.md). The focused runner tests passed and
the release freeze verified all eleven controls, exact retained populations,
and accepted current vectors. Seeds 300–329 were executed exactly once. Raw
report and analysis bytes are preserved losslessly in the evidence archives.
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

The separately cleared `run` action used the same arguments and output directory,
followed by the existing [analyzer](../../08/analyze.py) and lossless evidence
packager. No simulation or statistical loop was copied. Earlier reports remain
unchanged. No further execution, figures or review is planned under the user's
stop-tuning and ship instruction.
