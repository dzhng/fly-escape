# Campaign vision

Both campaign rooms enable the validated Tm2 visual input and model the existing sconces and exit glow as light sources. The purpose is to connect the displayed room to the available sensory pathway while preserving the existing game. Noticeable attraction, an easier game, a new lighting puzzle and additional sensory UI are outside the user's final scope.

## Why this shape

Authored emitters are shared between rendering and sensing so a visible lamp cannot silently drift away from its sensory location. Authoring resolves sources before exporting the level; neither Three.js state nor camera position feeds the simulation. The existing field sampler remains the runtime owner. See [shared emitter definitions](../../../packages/sim-client/src/house-lighting.ts), [campaign authoring](../../../apps/web/src/levels/house-lighting.ts), and their adjacent consumer tests.

Visual intensity and sensory rate are separate modeling assumptions, even though their initial numeric values match. These are game light fields, not calibrated photometry. The validated neural map and gain are reused without searching for settings that improve escape counts. The [neural rationale](../neural-vision/README.md) preserves the rejected motor-effect hypotheses and the narrower demonstrated neural response.

## Invariants

Campaign vision gain is 3. Both rooms retain 16 flies, their timers, original geometry and body configuration, odor/taste settings, ambient light, hazards and 2/5/10 star thresholds. About is unchanged. Visible fixture positions, colors and decorative artwork retain their existing meaning. [Campaign tests](../../../apps/web/src/levels/house-lighting.test.ts) pin gain and resolved emitter sources; the integration diff establishes preservation of other authored settings. [Renderer tests](../../../packages/game-renderer/src/house-lighting.test.ts) exercise the consumers, including moved/rotated fixtures.

Field measurements must consume resolved exports, not scrape the base TypeScript literal. The [native field probe](../../../crates/sim/examples/vision_probe.rs) accepts resolved JSON for this reason. Geometry/body-only fixtures intentionally retain their narrower base inputs.

## Evidence and limits

The actual resolved exports are deeply equal to the physical-light content used in the preserved [full native comparison](../neural-vision/assets/playtest/comparison.json). Simulation production code is unchanged since those runs, so that evidence is reused rather than described as a new native run. At seed 42 with empty placements, old/current vision-off trajectories match exactly; physical vision produces 3/2 escapes versus 4/2 without vision, all one-star outcomes. This limited comparison does not establish difficulty or attraction.

The [production browser record](assets/browser/summary.json) verifies source and tuning hashes against those native inputs. Both rooms complete their full horizons with 16 accounted outcomes, correct scoring, pause/seek/rewind, zero underruns, retained setups and retention of the pre-existing Open Window star. Browser seeds differ from the native comparison, and browser Open Window uses three saved bananas while the native runs have empty placements. These browser runs produce 3/0 escapes and 1/0 stars. Startup takes 966/1088 ms and return to editing 55/51 ms. These observations identify no functional regression; they do not guarantee unchanged balance across seeds.

The [verification record](assets/checks.json) records affected client/web/renderer tests passing (123 total), plus successful type checking, WASM/web builds and five affected Rust example tests. Independent code review found one harness invocation defect, resolved by the explicit Bun command `bun run test:campaign-vision`. The [harness](../../../tests/browser/campaign-vision.mjs) runs against a built production server; `CAMPAIGN_URL` selects it. It imports the actual level exports and records the final outcomes.

## Visual provenance

[Browser captures](assets/browser/) preserve setup, selected-fly rewind and final-result states for both rooms. The two `before-*` images come from the immediately preceding manual campaign playtest and define the established house/panel appearance. Open Window placements differ across setup captures, so the pair is structural evidence, not a pixel identity test. [Metrics and enlarged crops](assets/browser/visual/) locate differences without treating them as a correctness score. The target is a recognizable furnished room, readable selection and replay controls, and graphs directly below the brain.

[Visual review](assets/visual-review.md) records the fresh critique and retained limitations. [Choices](choices.md) records the final integration decisions.
