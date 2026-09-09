# Frozen retinal neural experiments

**The spatial/brightness panel does not pass.** These are native, fixed-input experiments with archived browser RGB bytes and controlled adapter fixtures. They do not complete slice 08 or establish a browser pose → tick → recorded-body chain.

The [preregistration](preregistration.md) preceded experimental Brain execution. The six-seed diagnostic panel failed its combined gate, then the already reserved thirty-seed panel ran every same condition and contrast without changing endpoints, gain, map, coefficients, initial state or duration. [Diagnostic evidence](diagnostic/evidence.json) and [held-out evidence](confirmation/evidence.json) retain both failures. All repeat, zero-input, silencing, brightness and dose controls pass in both panels.

The endpoint is the frozen 438-cell union on audited downstream path witnesses. All 1,176 injected Tm2/Tm20 indices and 1,696 motor/readout indices are excluded. Every one of the 40,944 structurally reachable non-input/non-motor cells has a spike count for every condition and seed, plus aggregate counts and full/downstream state hashes. Dark input has spontaneous activity: stimulus propagation is evaluated by paired differences, never by counting all spikes after a stimulus.

| Held-out contrast | Corrected voltage cells | Corrected spike-count cells |
| --- | ---: | ---: |
| Gray 64 − dark | 3 | 20 |
| Gray 128 − gray 64 | 0 | 0 |
| White − gray 128 | 1 | 0 |
| Left upper − right upper | 0 | 0 |
| Left lower − right lower | 0 | 0 |
| Left upper − left lower | 0 | 0 |
| Right upper − right lower | 0 | 0 |
| Floor opening − blocker | 0 | 0 |
| Flight opening − blocker | 1 | 0 |

Voltage was declared primary before data. Spike counts are the separate secondary endpoint; both share the Bonferroni family of 7,884 tests. The held-out critical t is 5.4991433. A voltage interval must lie wholly beyond ±1e-9 model units. That numerical floor is not a physiological significance threshold. Motor outputs are retained only as unselected descriptive readouts; no body was moved by this probe.

The raw pose panel includes every captured condition frozen into [the input pack](inputs-08.json), including the two additional apple poses present before freeze. Later changes to the live capture files were not imported. Every RGB input is a 4,326-byte file, with its SHA-256, available pose/scene provenance and explicit adapter controls. The fixed-pose floor/flight opening pairs retain both actual RGB batches; blocked input is not equated with complete darkness.

## Reproduce and inspect

The probe consumes the shared native `RetinalMap` and `retinal_currents`, then the unchanged `Brain`. Graph bytes and the published manifest remain untouched. Original graph/map/profile/source identities, seed lists, parameters, endpoints and input hashes are recorded in each `freeze.json`.

```sh
cargo test -p sim --example retinal_neural_probe --test retinal_map --test retina_tick
PYTHONPATH=scripts .venv/bin/python -m unittest discover -s tests/connectome -p test_analyze_neural_vision.py
cargo run --release -p sim --example retinal_neural_probe -- freeze \
  data/processed/brain specs/retinal-vision/assets/05 \
  specs/retinal-vision/assets/08/inputs-08.json /tmp/retinal-08-new
cargo run --release -p sim --example retinal_neural_probe -- run \
  data/processed/brain specs/retinal-vision/assets/05 \
  specs/retinal-vision/assets/08/inputs-08.json /tmp/retinal-08-new
.venv/bin/python specs/retinal-vision/assets/08/analyze.py \
  /tmp/retinal-08-new/report.json /tmp/retinal-08-new/freeze.json /tmp/retinal-08-new/analysis.json
```

The analyzer exits nonzero for the observed failed panel; this is a scientific gate result. Use the frozen `confirmation-inputs-08.json` for the thirty reserved seeds. The corresponding `inputs-09.json` and `confirmation-inputs-09.json` reuse the same archived byte pool for the color experiment. New output directories are mandatory: freeze and started markers prevent silent reuse. The current probe source must match a freeze before running; later output-only maintenance requires a new freeze, not bypassing source checks.

Raw reports and analyses are losslessly gzipped, with decoded-byte hashes and lengths in each `evidence.json`. `analyze.py` reads gzip directly. `package_evidence.py` verifies the decoded bytes before removing the uncompressed duplicate. This offline storage format is not a production record codec. The shared interval helper remains in the existing `connectome.analyze_neural_vision` owner; its seven existing tests pass.

## What the failure does and does not imply

All four single-sample spatial spots have equal actual injected dose, but their held-out voltage/spike intervals do not pass. Sparse input localization is a plausible sensitivity limit: only a small part of the supported input graph receives each spot. The full reachable population nevertheless changes spike counts under those paired inputs. That is propagation, not sufficient evidence for the frozen endpoint gate.

The 438-cell witness union samples particular audited paths, while many changed spike counts occur elsewhere among 40,944 reachable cells. Endpoint sensitivity is therefore another plausible limitation. The data do not show that the map is anatomically correct, nor do they justify rotating axes or relabeling cells to improve outcomes.

A concrete reslice could preregister a larger equal-supported stimulus area at the same gain and dose bounds, or a population-level response statistic over the full non-input/non-motor set with an independently justified noise/sensitivity analysis. Either needs a new frozen protocol and fresh seeds. The existing data may motivate those choices but cannot be reused as their confirmation. The optical registration question remains independent and needs source/landmark evidence rather than a preferred motor sign. No parameter, axis, seed or motor tuning was performed here.

[Verification, execution resources, visual limitations and decision audit](../08/verification.md) accompany the frozen results.
