# Retinal archive admission audit

**The 61-cell RGB proposal fits representative complete-record arithmetic under the existing conditional archive admission policy.** At 16 flies × 6,000 ticks, the proposed layout with two motion points per fly-tick costs **124,288,384 bytes (118.531 MiB)** under the existing conservative event/chunk allowances. At 129 points it costs **1,099,648,384 bytes (1,048.706 MiB)**. The maximum does not fit, which is already true of the baseline. It is not by itself a new failing gate: the current policy caps storage and reports variable-motion overflow explicitly. Full campaign measurements still decide practical acceptance; eye-byte arithmetic alone cannot replace them.

This is a read-only audit, dated 2026-09-09, of root revision `435c69a71fcb77be4386d453ff4642f14e6c97fc` and the current retinal contracts. No record format, admission policy, precision, event bound or motion behavior was changed. The layout below is a proposed schema-6 accounting model, not a built decoder.

## Source and ownership

- [Native record layout and admission](../../../../crates/sim/src/record.rs): 44 existing f64 value fields, two f64 values per neural group, five u32 state fields, eight events per fly-tick at five u32 values per event. At most 16 groups; the shipped manifest currently uses all 16.
- [Motion wire format](../../../../crates/sim/src/record/motion.rs): nine f64 values and two u32 states per point, or 80 bytes; every record has 2–129 points. [Body motion](../../../../crates/sim/src/body/motion.rs) owns that upper bound and only coalesces qualifying free-space joins to roundoff. Ordinary trajectories cannot be assumed to contain two points.
- [Native producer](../../../../crates/game-wasm/src/attempt_session.rs) and [client archive](../../../../packages/sim-client/src/record.ts): cumulative transferred buffer sizes plus 1,024 bytes per chunk and a 16,384-byte layout/result allowance. Motion offsets are one u32 per fly-tick plus one sentinel per chunk. Neural-step counts are one u32 per tick. The client's small motion cache is 6 bytes per fly, covered here by the metadata allowance, not counted as another history.

The present `archive_bytes` rejects an excessive **fixed** payload, but returns `min(fixed + maximum_motion, 128 MiB)` otherwise. Both producer and consumer later reject cumulative quota overflow. Thus current admission means “bounded archive with an explicit possible capacity error”, **not** “every allowed trajectory completes the admitted horizon”. Preserve that distinction when updating admission for retina. Clamping an over-cap estimate is not proof of a successful full round.

The accounting convention covers owned archive buffers and the existing object/metadata allowances; it is not a measured upper bound on the browser's complete JS heap. Graph and brain/WASM state, producer scratch, transfer buffers in flight and GPU targets remain separately reported resource owners. A transferred buffer becomes archive ownership and must not also be counted as a second retained copy. Retinal packing must count the actual backing allocation, as the client already does for subviews.

## Proposed field delta and assumptions

Use the contract's canonical uint8 eye buffer: `2 × 61 × 3 = 366` bytes per fly-tick. Remove the sixteen old directional brightness/blocked f64 values (128 bytes). Reuse `inputX`, `inputZ`, `inputHeading`; add the missing pre-neural height and quaternion as **five f64 values** (40 bytes). Keep existing post-step transforms, sensory values, states and neural groups. That leaves `44 - 16 + 5 = 33` base f64 fields and, at 16 groups, a 65-f64 stride.

This records one complete pre-neural **body** transform; the immutable eye rig/profile derives both eye transforms. Storing two redundant world-space eye poses is not assumed. Profile/scene/layout identities and rig metadata are per-attempt metadata within the existing allowance, not strings per sample. The existing sensory-presence bit expresses absent terminal inputs without another per-record flag. A sampled terminal-transition tick retains its real bytes. Conservatively reserve eye storage for all 96,000 fly-ticks regardless of early termination; no average occupancy, compression or eviction credit.

| Component | Bytes per fly-tick | Bytes for 96,000 records |
| --- | ---: | ---: |
| 65 f64 values, including 16 neural groups | 520 | 49,920,000 |
| Five u32 states | 20 | 1,920,000 |
| Eight events × five u32 values | 160 | 15,360,000 |
| Paired 61-cell RGB8 samples | 366 | 35,136,000 |
| Motion-offset entry | 4 | 384,000 |
| **Subtotal excluding actual motion points** | **1,070** | **102,720,000** |

Add 24,000 neural-step bytes; `1,028 × chunk_count` for each chunk's allowance and offset sentinel; and 16,384 metadata bytes. If `P` is the **total number of motion points**, including endpoints, the complete expression is:

`archive = 102,720,000 + 24,000 + 1,028 × chunk_count + 16,384 + 80 × P`.

The retinal change adds **26,688,000 bytes** over the existing layout for the same 96,000 records, motions, events and chunks. Adding RGB without removing the sixteen obsolete fields would waste another 12,288,000 bytes and is not the contracted layout.

## Complete bound, not just pixel storage

One tick per chunk is currently legal, so conservative admission uses 6,000 chunks. Ten-tick chunks use 600, but cannot be the admission assumption unless the protocol enforces that batching behavior (including final partial chunks).

| Motion points per fly-tick | 6,000 chunks | MiB | 600 chunks | MiB |
| --- | ---: | ---: | ---: | ---: |
| 2, minimum/stationary | 124,288,384 | 118.531 | 118,737,184 | 113.237 |
| 3 | 131,968,384 | 125.855 | 126,417,184 | 120.561 |
| 4 | 139,648,384 | 133.179 | 134,097,184 | 127.885 |
| 129, allowed maximum | 1,099,648,384 | 1,048.706 | 1,094,097,184 | 1,043.412 |

At 6,000 chunks and worst-case events, only **316,116 total motion points** fit: at most **3.292875 points per fly-tick on average across the entire attempt**. This is an aggregate byte limit, not permission to truncate individual traces to three points. At 600 chunks the ceiling is 385,506 points, or 4.0156875 per fly-tick. Four points with ten-tick chunks leave only 120,544 bytes of margin under the existing allowances.

At 20 flies × 6,000 ticks, even two motion points per fly-tick with worst-case events and 6,000 chunks require **153,808,384 bytes (146.683 MiB)**. Retinal lab admission cannot inherit a claim that every old 20-fly workload fits. The existing nonvisual path must retain its own admission behavior; an unsupported retinal workload must be rejected before starting. With a mechanical RGB addition, the current fixed-only native test for 20 flies would still narrowly fit (134,104,384 bytes before motion/offsets), then return the capped quota. Do not interpret that admission result as proof the 20-fly retinal workload can finish; the separate lab gate must decide support explicitly.

## Available observed baseline evidence

These are historical production observations, **not new retinal runs or a worst-case proof**:

| Preserved report | Horizon | Existing owned chunks | Same-record retinal projection, including metadata |
| --- | ---: | ---: | ---: |
| [Open Window](../../../done/campaign-vision/assets/browser/open-window-report.json) | 16 × 6,000 | 99,455,080 | 126,159,464 bytes / 120.315 MiB |
| [Turn the Corner](../../../done/campaign-vision/assets/browser/turn-the-corner-report.json) | 16 × 3,000 | 51,491,760 | 64,852,144 bytes / 61.848 MiB |

Projection is `ownedChunkBytes + flyCount × actualRecordedTicks × 278 + 16,384`, holding the original motion/event/chunk sequence fixed. Open Window has 8,058,264 bytes of projected headroom. The second observation is only a 3,000-tick run and cannot certify the new 6,000-tick gate. Neither report publishes total motion-point/event/chunk counts, so their individual contributions cannot be recovered exactly. No invented “observed average motion-point count” is reported. New retinal input can change trajectories; these projections are encouraging capacity evidence only.

## Finite encoding options for the owning slice

No option below is selected or implemented by this audit. The required immediate changes are to include the new RGB buffer and revised value stride in native admission, producer byte counting and client backing-buffer accounting; preserve the existing capped quota and explicit overflow behavior. **No motion compression or precision change is required solely because the theoretical maximum exceeds the cap.** Consider the options below only if measured full campaign runs fail the budget; they are contingencies, not additional work authorized by this audit.

1. **Lossless endpoint sharing.** The existing encoder already verifies that each motion endpoint equals the recorded post-step body transform. The proposed explicit input transform could similarly own the first endpoint after a new equality check. Fractions 0 and 1 are implicit. Retaining both endpoint state pairs while sharing their transforms reduces two 80-byte endpoints to 16 state bytes: **144 bytes saved per fly-tick**, or 13,824,000 bytes per full attempt. Preserve every interior point and all support/grounded flags. This improves practical margin without changing precision or trajectories, but the 129-point worst case still requires 1,085,824,384 bytes. Endpoint equality and replay sampling must be tested; current code only enforces the final equality.
2. **Lossless compact event records.** Current event arguments are small enum codes, and tick/fly identity can be implicit in per-record event slots. Eight `(kind,arg0,arg1)` byte triples plus a byte count cost 25 bytes instead of 160, saving **12,960,000 bytes** per horizon while preserving order and all eight events. This requires an explicitly versioned format and enum/range validation. Even combined with endpoint sharing, the maximum motion history remains 1,072,864,384 bytes. Do not simply shrink the event count ceiling.
3. **Reduce floating-point precision only through an explicit tolerance contract.** Nine f32 motion values plus two u32 states still cost 44 bytes per point; 129 points still require **653,824,384 bytes** with the other proposed fields unchanged. It cannot solve the worst-case bound alone. If existing input X/Z remain f64, making only five added pose values f32 saves 1,920,000 bytes; converting all seven position/quaternion values to f32 saves 2,688,000 bytes. This is a change to precision, not free compression. The eye request/record must agree on the consumed pose; rounding only the archived pose would misstate it. Reusing existing X/Z avoids adding a second standalone seven-float pose. Any motion quantization needs measured positional/angular tolerance, contact-transition and interpolation tests; f32 normalization can also change quaternion values.
4. **Bounded semantic trajectory encoding.** Retaining endpoints and required contact/mode transitions while approximating intermediate geometry could reduce point counts, but the current owner already performs a narrow exact coalescing step. A new simplifier must establish its error bound against collision/surface paths and prove a worst-case byte bound without discarding required transitions or altering dynamics. An average two-point observation is not that proof. At the unchanged fixed bound, 129 points would leave only about two bytes per point; general lossless f64 trajectories cannot be guaranteed to compress that far.

The first two are plausible lossless layout improvements if practical capacity proves insufficient; neither proves the full 129-point bound. The latter two are not recommended for this pass and would require explicit precision/trajectory contracts and a reslice. Increasing the cap, dropping eye channels, lowering the tick rate, silently dropping points or evicting recorded eyes does not satisfy the current gate. Existing explicit overflow handling prevents unlimited growth, but cannot be relabeled as a guarantee that an admitted full round completes.

## Reproduce the arithmetic

Run this standard-library snippet from the repository root. It reads the audited constants and preserved observations, and fails if the source dimensions have changed. It performs no simulation or mutation.

```python
import json
from pathlib import Path
root = Path('.')
record = (root/'crates/sim/src/record.rs').read_text()
motion = (root/'crates/sim/src/record/motion.rs').read_text()
body = (root/'crates/sim/src/body/motion.rs').read_text()
assert 'VALUE_FIELDS: [&str; 44]' in record
assert 'STATE_STRIDE: usize = 5' in record
assert 'MAX_EVENTS_PER_FLY_TICK: usize = 8' in record
assert 'VALUE_FIELDS: [&str; 9]' in motion
assert 'STATE_FIELDS: [&str; 2]' in motion
assert 'MAX_MOTION_POINTS: usize = 129' in body
assert len(json.loads((root/'data/processed/brain/manifest.json').read_text())['groups']) == 16
F, T, G, S, E = 16, 6000, 16, 61, 8
N, cap = F*T, 128*1024**2
per_record = (44-16+5+2*G)*8 + 5*4 + E*5*4 + 2*S*3
for chunks in (6000, 600):
    fixed = N*per_record + T*4 + (N+chunks)*4 + chunks*1024 + 16384
    maximum_points = (cap-fixed)//80
    print('chunks, fixed, max points, average:', chunks, fixed,
          maximum_points, maximum_points/N)
    for points in (2, 3, 4, 129):
        total = fixed + N*points*80
        print(points, total, total/1024**2)
for name in ('open-window', 'turn-the-corner'):
    p = root/f'specs/done/campaign-vision/assets/browser/{name}-report.json'
    report = json.loads(p.read_text())
    projection = (report['memory']['archiveOwnedChunkBytes'] +
                  report['spec']['flyCount']*report['computedTick']*278 + 16384)
    print(name, projection, projection/1024**2)
```

The snippet was executed successfully against the pinned root sources. Review found no missing retained numeric stream in the formula: values, states, events, neural-step counts, motion values/states/offsets, RGB bytes and envelope/layout allowances are all included. No new automated test or production edit is needed for this evidence-only pass. The integrating slice owns adding this report to its handoff, updating the existing admission/counting formula when the retinal buffer is implemented, and measuring both complete campaign horizons. Maintain the existing explicit-overflow semantics; reslice storage only if those actual runs fail, not merely because an unconditional maximum cannot fit.
