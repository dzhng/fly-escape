# UI mock review

This is an interactive presentation mock with illustrative activity and fly motion, not a neural simulation or a real 3D renderer.

Three appearance options use the same interface and scene: Sunlit house, Field notebook, Evening escape. Host design controls also expose placement/playback, panel density and white trails.

Verified interactions: 20 panel entries; world selection scrolls to a fly; card headings select their fly; close follow camera moves during playback; zoom-in/out; whole-house minimum zoom; tooltip open/close; edit/retry preserves placement; clicking the house consumes inventory; release shows a preparation state; play advances time; pause/scrub and speed controls work. Desktop and narrower layouts were captured, with no horizontal overflow in the narrow check. No external runtime data requests are used.

Independent screenshot reviews covered all initial mock captures and the subsequent close-camera candidates. Findings included grid overflow, cramped trace labels, faint night exit labeling, small scene scale, floating/oversized fly labels, crowded fly selection, card clipping after selection, and hint contrast. Layout sizing, trace gaps, exit contrast, default zoom, badge sizing, selected-last drawing, selection scrolling and hint surfaces were adjusted.

Remaining design limitations: room/fly art is schematic; walls and fly motion do not enforce real collision/depth rules. Crowded flies can overlap. Actual 3D implementation needs proper depth, camera-obstruction handling and a persistent selected-model outline. The full-house view intentionally prioritizes overview over fly detail. Only part of the 20-entry list fits at once; it scrolls. Numerical activity, seed outcomes, timing and star thresholds are fictional examples for interface evaluation. Pan is freeform in the mock; house bounds and RTS edge scrolling belong to implementation.

User feedback carried into the discovery map: close default camera, world/card follow selection with adjustable zoom, fully 3D implementation using Blender assets, and dead-end rooms. Pantry geometry in this mock has one doorway.
