# 04 — Color-model feasibility

**Depends on:** the pinned source research, not the optical implementation; run alongside 01–03. Spatial/eye geometry is frozen separately by slice 05. **Question:** what defensible color signal can our retained graph receive from rendered RGB?

## Contract and seam

This is a research-and-freeze slice, not permission to wire RGB channels to arbitrary cells. Inventory retained MaleCNS populations against the exact annotation and graph hashes, including Tm2, Tm20 and canonical Tm5 candidates. Verify spatial annotations and directed downstream paths separately from spectral physiology. Preserve graph bytes.

Create `assets/04/color-model.json` and a source-to-parameter ledger. They must name supported RGB-derived channels, color space, brightness branch, candidate targets, transfer functions/signs/baselines, total/per-cell dose bounds, missing UV information and the evidence for every anatomical assignment. Audit cross-dataset type correspondence; a FlyWire label is not automatically a MaleCNS cell identity. R7/R8 are absent, so their signals are a declared modeled boundary, not newly added receptor neurons.

The user requires final color inputs to influence the circuit. A human RGB mosaic feeding only scalar Tm2 brightness is not a passing solution. Conversely, do not label Tm20 subsets blue/green or assign RGB red to UV-associated cells merely to create a chromatic difference. A source-informed phenomenological response model is permitted if its unmeasured parameters and supported color gamut are explicit; physiology-calibrated color vision is not required. Unjustified cell partitioning is not delegated.

## Runnable artifact and verification

Add a bounded offline `scripts/connectome/color_audit.py` command documented under `assets/04/` that reads existing annotations/manifest and emits counts, eligibility and pathway witnesses. Render a small channel-response atlas from declared RGB patches, brightness-matched pairs and intensity sweeps. No neural or motor tuning occurs here.

Freeze both the primary color hypotheses and intensity/control conditions for slice 09. Check that the adapter retains at least two independent stimulus dimensions, that matched diagnostic luminance can change the chromatic input while brightness-branch output stays fixed, and that both eyes have supported targets. Verify the proposed combined channel budget before applying any weights. No fabricated UV from RGB, object semantics or emitter labels.

**Visual variable/crop:** channel-response atlas only; crop stimulus patches and their labeled channel outputs. Rendered fly appearance is out of scope. Compare to declared patch values/source response examples where a real target exists; run unprimed screenshot-critique last.

## Verdict and decision budget

Pass with an explicit source-supported model, retained target identities, fixed gamut/dose controls and a reproducible audit. Delegate source comparison, exact supported parameter estimates and candidate selection on anatomical/physiological evidence, **not** behavioral success. If evidence cannot justify a chromatic adapter in the retained graph, report exactly what is missing and reslice; color is not silently deferred. Graph expansion, new receptor models or new training require a separately specified slice before implementation. Existing graph/export tests remain green.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** planned; no implementation or verification result yet. Record the exact artifact, tests, observed limits and pass/fail verdict here when executed, then update the README handoff.
