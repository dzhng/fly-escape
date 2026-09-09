# 07 — Exact color replay and safe version rejection

**Depends on:** 06. **Question:** can the exact consumed RGB eyes be retained and decoded safely within one archive?

## Contract and seam

Implement development schema 6 in native `RecordLayout`/`PackedChunk`, WASM transfer and `FrameArchive`. Carry contiguous RGB8 samples, full pre-neural eye pose, presence and profile/color-model identity using the existing chunk owner. Remove the sixteen eight-direction numeric fields from the new layout; do not store RGB as f64. Old controls may retain their test-only artifacts, but do not implement a second production archive.

Extend admission and cumulative quota accounting before allocation. At the current 721-sample candidate, eye bytes alone cost 415,296,000 bytes at sixteen flies and 6000 ticks. Prove the full fixed and variable-motion archive fits; count transfer/staging/consumer memory independently. Retain all ticks, not just the currently selected fly. The display can be built later; this slice exposes decoded bytes in the workbench.

## Runnable artifact and verification

Add `bun run test:retina-record` using a native-produced cross-language fixture and real worker output. Archive fixture-generation commands and small schemas 5 and 6 under `assets/07/`. Compare neural-consumed, native-packed, JS-decoded and sought sample arrays by exact bytes. Include chunk boundaries, zero-current/color-black stimuli versus absent already-terminal input, terminal-transition ticks that consumed real eyes before the outcome changed, random seeking and selection changes.

Exercise the public decoder and its browser failure consumer with the actual schema-5 fixture, a future version, truncated/corrupt header and invalid payload. **Old replays must not crash:** show a handled unsupported-record message and a usable return-to-setup/new-attempt action. No unhandled rejection, blank app, partial poisoned archive, or change to saved stars/arrangements. A schema-5 fixture is a rejection test, not a compatibility reader. No new import interface is required.

**Visual variable/crop:** recoverable error state and controls, crop the message/action region. Compare with existing error UI for readability where applicable; run unprimed screenshot-critique last. Correctness remains a browser interaction assertion.

## Verdict and decision budget

Pass only when exact bytes survive replay, worst admitted records are bounded and old versions fail safely. Delegate buffer packing details and wording that preserves the specified meaning. Do not implement migrations, archive eviction or approximate replay. Practical archive sizing is delegated by the user; measure the current 512 MiB target before changing it. Existing record/motion/progress persistence tests remain green; update current-format fixtures explicitly.

## Review protocol

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for every stated reference comparison and [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before acceptance**, with an unprimed reviewer. If an additional visual report is generated, it inherits the same rule. Keep feature-owned evidence under `assets/`.

Human review is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while doing independent work, then decide from evidence if no response arrives, record the rationale and close the shots. Correctness/resource failures still fail. Any user feedback changing this slice's named variable must update its contract before further implementation.

**Status:** passed. Schema-6 archives preserve exact RGB and full pre-neural poses; malformed and old records produce recoverable UI without a compatibility decoder. See [record evidence](../assets/07/README.md) and [recovery review](../assets/07/recovery/README.md). Final campaign resource accounting belongs to slice 11.
