# Continuous reconstruction: aliasing corrected, detector still fails

The scalar sampler now uses at most four visible cell centres with bilinear weights and renormalization at barriers/domain edges. Unobstructed linear fields are exact; constant fields stay constant with visible support. Geometry, evolution, source injection, wind sampling, analytic exit cue, neural equations and production physical parameters remain unchanged. Visibility boundaries can still be discontinuous; this is not a higher-resolution transport solver.

In the identical real-graph reproduction, anatomical left/right values differ at every one of4097 scanned positions, versus only7 before. Relative contrast is now smooth and ranges0.0220–0.0303%, below the frozen5% cutoff. Neither anatomical boundary nor cell-centre starts inject odor current. All72 applicable anatomical/silenced comparisons reproduce their matched neutral motor/body trajectories exactly. The old300mm span remains detected across all4097 positions. This accepts removal of nearest-cell aliasing and explicitly rejects physical-adapter readiness; no biological sensitivity claim follows.

`summary.json` records identities, phase statistics and all144 compact run results; `raw.json.gz` retains every sample/tick. The unchanged `crates/sim/examples/physical_sampling.rs` is the runnable probe. Source/body dimensions and the detector remain frozen. The next step is a separately specified sensory-adapter calibration, including vision, before production anatomical defaults or campaign tuning.

## Verification and review

Three focused reconstruction tests pass, covering constants/domain bounds, interior linear fields and phase continuity, exact centres, walls/solids, hidden containing-cell support, positivity/bounds and no support. Replacing only sample_point with the previous implementation makes all three fail for expected numeric reasons; restoring the correction returns green. All38 targeted Rust tests (library, environment, body, house geometry and placement) pass. No old assertion was weakened.

A fresh release WASM build and the existing browser field harness pass mirrored odor, deterministic reset, opposite light/shade responses, local exit and world-space wind with no browser errors. Its numeric report is retained in browser.json; generated screenshots are incidental harness output in /tmp/continuous-browser-fields, not a visual acceptance claim.

Root reviewed single ownership and scope: four local supports, no grid-wide search/allocation, no transport mutation, no new config or controller. Independent worker review was unavailable after account usage exhaustion; no independent-review claim is made. Existing Codex CLI review remains unavailable under its configured model as recorded in earlier passes. Numerical evidence supports this bounded correction; campaign acceptance remains open.
