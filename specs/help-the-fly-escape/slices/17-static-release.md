# 17 — Browser release and clean cutover

Status: cleanup/About preparation integrated; measured renderer retainer repaired; final release verification pending. Dependencies: 16.

## Contract and seam

A static build contains the complete game, real graph, models and reproducible evidence.

Root build pipeline → web distribution and documented local serving; remove obsolete Python runtime consumers.

## Runnable review surface

Production-mode game served locally, performance report, data/model attribution and clean-start instructions.

## Verification

Repeat ten full actual-graph 20-fly attempts in production build; report load/wait/frame/input/memory metrics, cancellation and hidden-tab behavior. Chrome full suite plus Firefox/Safari smoke where available; missing coverage is explicit. Verify no runtime API/backend requests, no missing assets, no memory growth across retries. Audit cleanup already performed in earlier slices; keep useful exporter/reference fixtures and delete any remaining obsolete runtime/scripts/data paths and dependencies. No existing spike code has a retention requirement. Audit active docs for false shipped claims.

Visual variable and crop: Whole-game composition only after individual variables pass; overview/follow/panel/result captures. New art direction is out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Measured renderer lifetime repair

The internally supplied lighting texture must have renderer-local listener/GPU ownership even when its immutable data is shared. Disposing one world must release its retired canvas and leave another live world unchanged. The version-specific dependency patch and [before/after evidence](../assets/evidence/17/renderer-lifetime/README.md) close that measured retainer defect; remaining main-heap growth and full release verification stay open.

## Decision budget

Delegated: Packaging/compression and measured resource optimization with fidelity gates; no compat layers, PWA/offline cache or deployment service required.

Human feedback that changes this slice: Unexpected wait or platform failure requires evidence-led reslicing, not reducing graph/fly count.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/17/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.

## Measured retry lifetime issue

[Repeated actual attempts](../assets/evidence/17/retry-resources/review.md) preserve a single Worker and stable WASM allocation but retain old renderers through a Three.js shared lighting texture. The dependency ownership repair and repeated-disposal/two-live-view checks are recorded above; remaining heap and final release coverage remain open. The patch must keep the current library version and lighting appearance; final production metrics remain a separate gate.

[Shared skeleton ownership](../assets/evidence/17/skeleton-sharing/README.md) removes duplicate bone textures within each cloned fly while retaining independent animation between flies. This closes a bounded resource amplification defect, not the final twenty-fly performance gate.

[Failure-state recovery](../assets/evidence/17/failure-recovery/README.md) verifies retained scene redraw after producer failure, bounded renderer-error handling and a fresh attempt after either fault. [Native-trap recovery](../assets/evidence/17/wasm-recovery/README.md) retires a damaged Worker and verifies fresh setup/playback, including cleanup failures. Final platform, performance and repeated resource coverage remain separate gates.

[Setup cancellation](../assets/evidence/17/setup-cancellation/README.md) prevents a pending placement-validation request from reviving its disposed Worker after a level switch. Six actual second-house release/cancel cycles preserve one Worker and stable DOM counts with the textured fruit; heap variability and final full-attempt coverage remain open.

A [paused-frame CPU audit](../assets/evidence/17/paused-cpu/README.md) measures repeated motion, trail and furniture-cutaway work in the actual first house. Their small observed cost does not justify additional caches. The narrow main-thread profile does not establish whole-house, GPU, Worker or sustained-run performance.

The [sustained retry harness](../assets/evidence/17/full-retry-harness/README.md) now runs complete actual campaign attempts at 1× and can replay captured seeds through the normal setup UI. It preserves cancellation as the default, saves failure evidence, and rejects vacuous post-warm-up comparisons. Its random second-house run exposed a supported-motion refinement failure. The [native and rebuilt-browser repair](../assets/evidence/30/refinement-contact/README.md) closes that captured case; repeated-attempt and final release gates remain open.

A subsequent ten-attempt batch failed on attempt four with a distinct [query-budget error](../assets/evidence/30/query-budget-contact/README.md). Repair bounded-motion recovery before repeating sustained acceptance; three completed attempts do not close this gate.
