# 05 — Spatial and channel registration

**Depends on:** 02, 03 and 04. **Question:** can the frozen color model be assigned spatially to retained neurons with explicit coverage and dose bounds?

## Contract and seam

Extend the existing offline `scripts/connectome/vision_map.py` owner and native `graph.rs` validator with the frozen retinal layout and color model. Use the sparse registration obligations in [contracts](../contracts.md#retinal-to-neural-mapping). Full-source family bounds define scale; do not stretch the selected subset to fill the eye. Keep left/right cell identities and both hex coordinates.

A map entry identifies a retained neuron, same-eye spatial taps and the frozen channel response. Metadata carries graph/annotation/rig/layout/color-model hashes, support masks and a plainly labeled modeled registration. Reject motor overlaps. Spatial taps are nonnegative; signed chromatic coefficients are valid only as specified by the slice-04 model and its final per-cell current bounds. Audit combined brightness+chromatic current at each cell; distinct pathways do not each receive an independent full gain budget.

Keep the current production map only as the named baseline control until slice 11. Publish the new map to feature-owned experimental artifacts and the workbench, not by silently rewriting a production manifest halfway through the ladder.

## Runnable artifact and verification

Provide one deterministic export command in `assets/05/reproduce.md`; two exports must yield identical bytes. Produce a per-eye atlas showing supported/unrepresented samples, eligible/rejected cells, local taps, current totals and source path witnesses. Reuse graph identity and motor-exclusion tests, adding RGB channel order, color-model identity and mixed-channel bounds.

Test uniform gray, primary-color basis patches, equal-brightness color pairs, left/right supported-area pairs, negative spatial taps, nonfinite coefficients, signed chromatic coefficients both allowed and forbidden by the frozen model, missing color model and mismatched layout. Report changed dose relative to the prior brightness-only map; do not force equality by adding unbounded gains. A path witness remains structural evidence.

**Visual variable/crop:** registration coverage and eye orientation in the atlas. World rendering and neuronal behavioral effects are out of scope. Compare to the frozen rig/layout and source column atlas, then run unprimed screenshot-critique last.

## Verdict and decision budget

Pass when the sparse mapping is reproducible, bounded, source-bound and honest about coverage. Delegate internal data layout, stable ordering and local interpolation implementation within the frozen formula. Spectral coefficients are inherited from slice 04, not invented here. Any need to change profile, cell families or source bounds reopens its owning slice. Existing graph publication tests must stay green.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** planned; no implementation or verification result yet. Record the exact artifact, tests, observed limits and pass/fail verdict here when executed, then update the README handoff.
