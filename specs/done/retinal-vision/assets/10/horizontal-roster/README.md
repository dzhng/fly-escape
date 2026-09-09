# Horizontal fly roster

The roster uses one horizontal row so selecting a fly leaves room for its eyes and neural activity. Existing native buttons retain their labels, pressed state and tab order. The existing selection owner scrolls the chosen card into view; there is no second selection state or custom keyboard controller.

The [physical browser check](../../../../../tests/browser/physical-eyes.mjs) failed on the grid because it occupied multiple rows, then passed with the strip. It visits all sixteen buttons through Tab and Space, activates offscreen selections without the browser test driver scrolling them first, and checks the selected card is fully visible. Physical eye-pixel checks, seeks across chunk boundaries, terminal input, spectator-camera invariance and vertical scrolling remain covered at both widths.

[Geometry and pixel telemetry](comparison-metrics.json) compare the right column at matching viewports and the same selected physical input. The spectator camera is excluded from pixel comparison. The roster and its visible scroll cue shrink from 272 pixels at desktop and 364 at narrow width to 71 pixels in either layout. Changes below it are the intended upward movement of the eye and neural panels. Partially visible unselected cards lie beyond the horizontal scroll viewport; the selected card remains complete.

The full before/after frames, enlarged strip crops, paired-eye crops and bottom-of-panel captures are retained here. The first fresh review identified a weak scrolling affordance when several whole cards fit. A short visible scroll cue addresses that without another navigation controller. The final integrating verdict is recorded below.

Typechecking, all ten web tests and the physical browser checks pass. Independent code review found no actionable regressions after the scroll cue was added. The integrating task subsequently ran the final fresh review.

The final integrating review inspected the complete comparison set and refreshed
root captures against the final manifest. Eye/detail layout passed. It noted
partially clipped unselected cards and the small scroll cue. These are accepted
scroll-viewport boundaries: the cue explicitly names horizontal scrolling, every
button remains reachable by pointer and keyboard, and the selected card is
verified complete. No item or identity is removed. The root rerun passes all
sixteen selections at both widths. This implements the user's horizontal-strip
request; the prior grid is retained only as comparison evidence.

The updated root views were opened together for the human checkpoint. With no
further change requested during the review interval, the compact strip was retained
on the evidence above and the review window was closed.
