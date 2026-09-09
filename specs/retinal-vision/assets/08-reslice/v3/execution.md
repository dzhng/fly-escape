# Spatial v3 execution handoff

Status: protocol files prepared; build, pack materialization, source freeze and
Brain execution remain held pending root clearance after performance measurement.
The accepted input proposal and current oracle are unchanged. Seeds 300–329 are
reserved, not executed. [The preregistration](preregistration.md) is the neural
and statistical contract.

After clearance, use the existing preparation owner with `--version 3`:

```sh
python3 specs/retinal-vision/assets/08-reslice/prepare_run.py \
  data/processed/brain specs/retinal-vision/assets/08-reslice/prepared-v3 --version 3
```

This creates only the spatial pack and copies its bound artifacts. Run the
existing runner's focused checks and build before the separate freeze action:

```sh
cargo test -p sim --example retinal_neural_probe
cargo run --release -p sim --example retinal_neural_probe -- freeze \
  data/processed/brain specs/retinal-vision/assets/05 \
  specs/retinal-vision/assets/08-reslice/prepared-v3/inputs-08-v3.json \
  specs/retinal-vision/assets/08-reslice/confirmation-08-v3
```

Review the frozen seed, population, current and control bindings before the
separately cleared `run` action using the same arguments and output directory.
Then use the existing [analyzer](../../08/analyze.py), evidence packager and
figure owner on the new output. No simulation or statistical loop is copied
into this directory. Earlier reports are never overwritten.
