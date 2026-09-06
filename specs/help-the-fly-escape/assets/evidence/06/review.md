# Camera preparation review

Functional camera checks pass on the production route: shared model/card selection, close follow, extra zoom, overview, drag, keyboard and edge pan, visible keyboard focus and card scrolling. Three pure projection checks cover centering and whole-room fit, including following a fly near the edge. See [browser checks](checks.json).

Visual acceptance remains open. All five full captures and three enlarged selection crops were inspected independently. The dense active-work fixture places flies closer together than the placeholder geometry spans: wings and bodies merge into a strip and the yellow ring can surround pieces of neighboring flies. These are high-confidence visible defects in this review surface, not evidence that the picking math is wrong. Panel text remains readable; the roster's partial edge rows need a clearer scroll affordance in the science-panel pass.

The next visual checkpoint needs separated models at close framing, while retaining the dense fixture as a functional regression. Model silhouette and scale belong to the real-asset/workbench pass; neither the complete 20-fly benchmark nor physical spawn positions should be quietly weakened to make this screenshot pass. The candidate has no black/blue model focus outline, but marker clarity is not yet accepted. Absolute metrics are under `metrics/`; no historical same-state pixel comparison has been claimed.

Independent CLI code review remains unavailable because the installed client rejects its configured model. Root inspected the camera, input and consumer changes. Camera constants are delegated by the spec; startup follows fly 0 provisionally to satisfy close default framing. Slice 05 sustained performance remains a dependency gate.
