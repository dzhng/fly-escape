# 02 — Low-resolution acquisition feasibility

**Depends on:** 01. **Question:** can actual room capture produce readable color eye samples within our time and storage budgets?

## Contract and seam

Build the first `/retina` workbench in `apps/asset-lab` with a fixed pose and the existing authored mesh loaders. Prototype `RetinaCapture.acquire(VisionRequest)` in the intended worker/OffscreenCanvas WebGL2 environment. This is an acquisition probe, not a second live simulation. Use actual room assets and concurrently render the player view so a trivial cube-only benchmark cannot pass the gate.

Start at 32×32 RGB acquisition, 61 RGB8 compound cells per eye and fixed 10 Hz. Follow the bounded profile matrix in [contracts](../contracts.md#resource-budgets), varying raster size and sample layout separately. Keep color. Retain the exact pooled RGB bytes and display their mosaic. Quantization and linear-light pooling follow the profile, not a UI filter.

The probe's temporary fixture-to-scene assembly is named `retinaFixtureScene`; slice 03 replaces it with the shared world factory. It may call existing loaders but may not copy room coordinates. Do not introduce a general rendering backend interface or commit to a CPU optical fallback.

## Runnable artifact and verification

Provide `bun run dev:retina` linking to `/retina` and `bun run probe:retina-capture` driving a hardware browser. These are planned commands to add in this slice. Save exact commands and results in `assets/02/`. Test one and sixteen flies, cold asset initialization, warm complete batches, concurrent playback, cancellation while readback is pending, and context loss.

Measure submission, GPU wait/readback, pooling, copies into WASM-sized buffers, p50/p95/worst latency, atlas buffers, GPU resource estimates and retry plateaus. Validate the actual loader in a worker, including textured assets. Compute native record admission using proposed RGB bytes and full pose fields, remaining fixed fields, motion and event bounds. 35,136,000 RGB bytes alone do not prove that the complete archive fits.

Quality fixtures: lateral colored patches, one doorway seen from floor and flight height, furniture edges, and asymmetric small targets at stated distances. Require correct eye/channel orientation, visible doorway separation and reproducible sample changes as a landmark crosses cells. Freeze minimum landmark angular sizes and the pass/fail mask before comparing candidates; do not reject a low resolution for texture detail outside this task.

**Visual variable/crop:** spatial readability in eye interiors; use the highest tested profile as a quality reference, not a pixel identity target. Color conservation is a byte/patch test. Run compare-screenshots and then unprimed screenshot-critique on the selected profile.

## Verdict and decision budget

Pass only when one profile meets declared readability, archive and timing gates. Freeze profile/backend and update all dependent contracts. Delegate selection among the listed color profiles using measured evidence; no grayscale, automatic rate drops, increased archive cap or hidden main-thread fallback. If worker capture fails, reslice this backend decision before proceeding. Product runtime remains on its baseline visual path during the experiment.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** planned; no implementation or verification result yet. Record the exact artifact, tests, observed limits and pass/fail verdict here when executed, then update the README handoff.
