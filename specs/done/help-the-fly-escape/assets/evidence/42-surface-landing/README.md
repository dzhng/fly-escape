# Surface visibility and landing completion

The user reported that flies on dishes disappeared into them when zooming and could remain in Landing indefinitely. These checks separate the visual size mismatch from physical landing progress.

## Physical landing

A native regression starts a flying body above the dishes with a persistent landing signal and turning input. Before the fix, it remained airborne after three seconds, turning at a fixed height above the plate. The combined-turn collision fallback repeatedly consumed the descent. A safe descent at the retained orientation now takes precedence when its contact is a verified upper support root. The ordinary sweep and impact checks still decide acquisition.

Acquisition ends the remaining movement in that tick. Reusing leftover flight velocity for supported walking could otherwise exhaust the query budget and discard a successful landing. Walking begins with the next body's motor sample. The regression covers both turn directions on the plate and bowl. Captured shoe-rim tests now require verified landing rather than preserving the former turn-only behavior; their intermediate-pose nonpenetration checks remain. A separate long supported-travel request still verifies safe restoration when bounded work is exhausted.

## Display clearance

The renderer receives the resolved native contact surfaces. Its enlarged, animated body is lifted vertically just enough for its conservative oriented bounds to clear those triangles. Native position, orientation, neural inputs, physical support and recordings are not rewritten. Current bone influence bounds include the animated geometry without CPU-skinning every vertex each frame. Surface and triangle bounds reject irrelevant geometry before the contact calculation.

The [browser harness](../../../../../../tests/browser/surface-clearance.mjs) renders the real house, object and animated fly assets. Fixed poses come from the native contact fixtures, not neural attempts. Each before frame disables only display clearance; each after frame enables it. An independent triangle-height check examines every actual animated mesh vertex. It reproduces penetration in the negative controls, including a visibly obscured fly beside the bowl, and requires zero buried vertices in every corrected view. Zooming out after zooming in must restore pixel-identical output.

`report.json` contains all eight view pairs, recorded versus displayed positions, vertex counts, browser errors and a sixteen-visible-fly CPU rendering comparison with GPU identity. The timing is CPU frame submission, not a claim about GPU frame time or neural throughput. `pixel-diff.json` records that the candidate changes actual rendered pixels. Full frames and fly-centred crops cover all captured states.

The conservative display box can leave small gaps on curved detail, and native-size compensation still changes the apparent fly/object size ratio across zoom. The fix preserves that existing readability choice; it does not claim physically scaled insects at every view or eliminate every form of object-contact trapping.

## Requested route change

The user also requested removing the direct hall-to-living-room doorway. Its opening is replaced by the continuous physical wall, and no door frame is rendered there. The wider office opening remains; the route now passes through the kitchen before reaching the exit room. The route regression failed with the shortcut and passes with it closed, while retaining access to every room. Earlier four-minute progression counts belong to the previous layout; no new campaign balance claim is made here.

The second house’s release moves from the office to the bottom room, clear of the cabinet and dishes. Its zapper moves against the hallway’s upper wall. These are user-requested layout edits; object roles and inventory stay unchanged. Native setup validation and the route check cover the edited level.

## Doorway alignment

The widened office gap retained a narrow decorative frame at its former position. Frames now derive from the same physical room openings as the route checks and diagnostic crossing paths. The native frame posts spread to the opening’s endpoints without growing thicker; the lintel spans the gap. A negative-control test with fitting disabled failed alignment, then passed with fitting restored. `office-frame-before.png` preserves the mismatched frame; `closed-shortcut-setup.png` shows the corrected frame and sealed hall-to-living-room shortcut.

## Checks

All 37 body integration tests and 40 Rust library tests passed, including the 18 motion-consumer cases. The renderer suite passed 79 tests; client tests passed 31 and web tests passed 6. TypeScript checking, rebuilt WASM, and both production builds passed. Independent Codex reviews of the surface/landing changes and the doorway alignment reported no actionable issues. Native WASM initialization placed all sixteen second-house flies inside the requested bottom-room release area.
