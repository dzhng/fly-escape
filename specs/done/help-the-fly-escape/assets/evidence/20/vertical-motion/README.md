# Core-recorded vertical motion

This checkpoint replaces display-only height with native root height and an airborne Landing mode. It accepts floor takeoff/descent and replay plumbing, not curved fruit contact or final campaign difficulty.

## Physical and replay evidence

The core keeps existing neural landing/feeding thresholds and planar motor gains. Initial flying bodies start at cruise height; takeoff rises continuously, a landing pulse latches descent, and touchdown begins the ground dwell. Taste and feeding remain unavailable during descent. Terminal height uses the actual terminal fraction of the step and then freezes.

All sim tests passed, followed by the affected body/lifecycle/record checks after the diagnostic update. The airborne regression fails when instantaneous Walking replaces Landing, then passes restored (`contact-height-falsification.log.gz`). Packed records use schema2 and64-bit height; the Rust fixture includes distinct nonzero heights which decode exactly through the TypeScript archive and pose history. Client tests, TypeScript and strict core Clippy pass. The final renderer suite has31 passing tests. The two obsolete renderer-height tests are replaced by physical body tests and direct recorded-mode clip checks.

`lifecycle/browser.json.gz` records the production browser gate. The same seed6 meal gains3.75 reserve units and starves at tick173; proboscis silencing gains zero and starves at108. The unchanged test also proves contact-loss meal ending, open/blocked exit behavior and exact reset. `playback/checks.json` records the20-fly production pause/seek/2×/replay/restart/shared-time check. Motion captures use real lifecycle frames; landing and feeding clips restore exact canvas bytes on reverse seek.

The original1.2m diagnostic food disk failed once descent became physical: first descent began at44 inside it, but touchdown at51 was beyond its edge. `failed-original-meal.json.gz` preserves that record. The diagnostic patch alone grows to1.5m, covering the bounded extra0.272m of descent travel; the seed, neural gains and full behavioral assertions remain unchanged. This is controlled flat food, not a campaign apple or a level calibration claim.

## Production visual comparison

Baseline is commit58ca870, archived into a temporary source tree, installed with the frozen lockfile, compiled to WASM and built as the real web app. Candidate is the current source. `capture.mjs` drives the root setup/playback route with seed42,20 brains, no placed tools, the same viewport and chosen fly, and fixed recorded times in close and Overview. Candidate reverse-seek canvas bytes match at every captured state. Comparison values use the actual1075×525 world crop; full-frame differences include unrelated live computed-buffer text.

Both tick0.5 frames are pixel-identical. At3.5, close changes13,312 world pixels; the broad legacy stripe becomes a thin trace following the recorded ascent. At8.5, close changes8,910 pixels; Overview changes949. Full frames, subject crops, reports and the complete comparison set are retained. These are real production changes, not a re-anchored no-op test.

The first candidate retained the old1mm minimum trail width and exposed a broad white stripe. The focused high-zoom regression measured100px instead of1.5px. Final ribbons use the shared camera's pixel offsets at each endpoint and three-dimensional path length, without the old12mm lift. A real perspective-camera test covers vertical segments, both endpoint depths, native close zoom and unchanged recorded centres. `comparison/intermediate` preserves the rejected stripe captures. One intermediate wiring error passed an uninitialized camera to trails; TypeScript and the browser rejected it, and initialization now precedes consumption. Final type/build/browser checks supersede that failure.

## Adversarial visual review — primed fallback

Agents remain unavailable after the reported usage limit; no independent visual or CLI-review claim is made. All captured views and crops were inspected. The lifecycle overview still uses its procedural diagnostic fly; native GLB appearance is judged in the motion workbench and production gameplay captures.

- Strongest case against native trails: several white traces cross the close view and the selected trace enters the yellow ring. Verdict: final traces remain thin and the fly's body stays readable; the endpoint gap excludes its model. Dense final-house contrast remains24's gate.
- Strongest case against Overview: enlarged flies overlap in the clustered start, hiding individual wings. Verdict: retain the user-authorized readability exaggeration and close selection; this pass does not claim to resolve crowd overlap.
- Strongest case against touchdown: uniform floor shading gives little depth information about individual feet. Verdict: the core proves zero support height and no early taste; screenshots prove clip/pose consumption, not microscopic planting or curved support.
- Strongest case against room context: close follow shows mostly flat color, and the house remains a bare fixture. Verdict: no furnishing/material acceptance;21–24 and the two authored levels remain open.

Preview opened at06:28:13 UTC and closed after the five-minute non-blocking window on2026-09-07 without new feedback. Proceeding uses the recorded technical verdict, not inferred user approval.

## Review and next work

Root shape/diff/docs review removes renderer height inference, obsolete trail motion reconstruction and previous-mode storage. The camera alone owns projection and pixel offsets. The core owns vertical motion, mode transitions and terminal timing. No graph changes, steering cheats or application backend are added. Runtime additions are one height scalar per frame, one recorded mode, and a camera offset operation; redundant presentation state is removed. The meal runway and provisional vertical envelope are recorded in the choices ledger.

Next: authored edible meshes and stable support identity through one prepared contact scene per attempt, then continuous supported movement and curved replay. The actual native hull and20-brain curved-food replenishment control remain unaccepted. Do not carry the planar food-overlap path into20 closeout.
