# A visible-only color hypothesis

The retained graph can receive two independent rendered stimulus dimensions without inventing neurons or their positions: diagnostic brightness through Tm2, and a blue-sensitive proxy through Tm20. [The frozen model](color-model.json) owns the equations, controls and explicit limitations. It is a source-informed approximation, not measured fly hue physiology. Neural discrimination remains untested.

[The inventory](inventory.json) joins exact MaleCNS body identities to the shipped graph, verifies annotation and graph hashes, and records every candidate's columns, rejection reasons and directed path witnesses. Tm20 is eligible in both eyes. Retained Tm5a/b/c have no usable column annotations, so physiological relevance does not license spatial input assignments. Tm5Y is a distinct exact label, not a Tm5a/b/c alias. The annotation's `flywireType` agrees with each retained canonical Tm20/Tm5a/b/c label; no FlyWire body identity is transferred.

The [source-to-parameter ledger](sources.md) distinguishes physiological evidence from the unmeasured mapping choices. RGB cannot recover a UV spectrum. No red-to-UV mapping, pale/yellow partition, artificial receptor, graph expansion, training or movement rule is introduced. Pure red and green stimuli with equal diagnostic brightness and blue content are indistinguishable to this model.

The [atlas](channel-atlas.png) is generated from canonical bytes and the exact transfer functions. Swapping its matched patches between two equal-supported retinal locations preserves each location's brightness and the total blue-channel input. Slice 05 must establish equal supported areas and verify the actual weighted per-eye dose; the unweighted patch identity alone cannot certify that. Uniform matched-color fields change total blue dose and are diagnostic conditions, not the equal-dose proof. All downstream tests must exclude **both** injected families.

One combined visual-current budget is mandatory. Numerical spatial weights, family allocations and actual total-dose bounds belong to slice 05. The model artifact specifies the bound obligation, but does not pretend to be a runnable production current map or a passed combined-weight gate.

## Reproduction

Run from the repository root using the existing connectome Python environment:

```sh
PYTHONPATH=scripts .venv/bin/python -m connectome.color_audit --annotations data/raw/body-annotations.feather --output /tmp/color-audit
.venv/bin/python -m unittest discover -s tests/connectome -p 'test_color_audit.py'
```

The exporter reads the shipped manifest and graph by default; its help exposes alternate artifact paths. It emits a deterministic inventory, model and SVG atlas, without writing graph or production adapter files. Compare its outputs byte-for-byte with this directory. The PNG is the SVG captured in headless Chrome at 960×660, device scale one. [Pixel checks](visual-metrics.json) compare every patch center to its declared linear-to-display conversion; they do not compare to a biological response photograph.

## Verdict

Source/anatomy inventory and channel-information gates pass. The model and experiment controls are frozen before neural tests. Spatial combined-budget verification, neural proof and production integration remain open in their owning slices. [Verification](verification.md) records the exact checks and visual review. The broader Tm5c model was rejected for missing spatial source data, not because of a failed motor experiment.
