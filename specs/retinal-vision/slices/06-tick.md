# 06 — One eye batch per neural tick

**Depends on:** 03 and 05. **Question:** does the matching complete eye batch enter each neural tick exactly once?

## Contract and seam

Implement the native prepare/commit seam in `Attempt`, exposed by `AttemptSession`; integrate `RetinaCapture` into the existing attempt worker as specified in contracts. Request all active flies together from full beginning-of-tick body state. Await one acquisition, validate its complete identity and bytes, then execute the existing fields/current/brain/body order. The sensory adapter receives RGB8 with the frozen color map.

The existing baseline `step` entry may remain only for production/control callers until slice 11. Both paths must converge on one internal tick implementation; do not duplicate the body loop or neural stepping. No fields advance during preparation. Expose the pending tick in the `/retina` workbench as diagnostic state.

## Runnable artifact and verification

Add native tests using canned `RetinaBatch` values, then a real browser one-fly worker probe (`bun run test:retina-tick`). Inspect exact request identity, full input transforms and current inputs before and after commit. Store structured results in `assets/06/`.

Test repeated prepare, duplicate commit, missing one eye, wrong fly/order, short RGB buffer, stale/future tick, profile mismatch, cancellation during acquisition, late completion after restart and terminal flies. No malformed batch may partially advance fields or a brain. Assert at most one pending batch and the existing bounded chunk credit count. Force context loss and an unresponsive acquisition; failures must settle through the handled failure path and allow a new attempt.

Keep the player camera moving while delaying capture and verify simulation poses stay frozen. Observe no main-thread or worker busy polling. Use the same recorded input batch in native and WASM to compare neural/body results through the established numerical contract.

**Visual variable/crop:** tick-state diagnostics only. If a diagnostic screenshot is produced, compare to its known request fixture where applicable and run unprimed screenshot-critique last. A UI screenshot does not replace state-transition tests.

## Verdict and decision budget

Pass when causal ordering, at-most-once stepping and cancellation hold. Delegate native internal factoring and bounded buffer reuse. Request sequencing, failure behavior and whether ticks wait are not delegated. Nonvisual attempts, worker cancellation/retry tests and prior movement tests must remain green.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** planned; no implementation or verification result yet. Record the exact artifact, tests, observed limits and pass/fail verdict here when executed, then update the README handoff.
