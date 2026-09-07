# Native support sampling

Component verdict: geometric support sampling is implemented in the existing Rust contact owner. Body acquisition, walking, orientation transitions and recorded support are still open. This does not accept moving apple contact or slice20.

`ContactScene::support_at` uses the selected surface's bounds and the oriented hull's bounds to cast from above the complete object. It returns the native root and core rotation separately from the contact witness and normal. A missing surface ID is an error; a column without hull contact returns no support. This is a geometric candidate, not permission to teleport there. Physical acquisition and reachable transitions remain the body owner's responsibility. The ordinary cast and support sampler share the same prepared triangle-query implementation.

The native-hull apple probe has601 sampled poses with static contact gaps between approximately−7.4e−17m and1.2e−11m. Yet ordinary straight pose interpolation penetrates by up to1.8µm between samples. This is a numerical diagnostic, not a browser visual verdict or a guarantee between every animation phase. Its smoothed normal field is temporary probe input, not a new production orientation policy. It confirms that valid endpoints alone do not prove valid replay.

A separate approach matrix produces14 apple contacts. Each cast-derived landing root agrees with the sampler at the same position and orientation to within1.7e−14m. These cases support using the sampler after physical acquisition; they do not prove arbitrary side contacts or rotating acquisition. The unadopted native hull remains the earlier finite-sample candidate.

The isolated release probe takes about2.99seconds for6,010 support queries, excluding its normal-field preparation. That single native measurement is not a browser performance result. Main-thread sampling for every rendered fly is not accepted on this evidence; buffered path representation and worst-case archive/work budgets remain the curved-replay pass's decision.

The complete sim suite, eleven surface tests, strict library/test clippy and TypeScript pass. The root-versus-witness regression fails when those positions are deliberately conflated. Elevated geometry, tilted orientation, absent support/identity and invalid pose inputs are checked. The browser harness preserves the prior native floor and curved-query matrix and adds five native-hull apple support cases with independent static contact checks. Native and Chrome WASM values agree exactly through ten repeated reports.

Root shape/code/docs review retained one query implementation and no per-sample mesh preparation. No runtime dependency, record schema change, controller or main-thread physics path was added. Independent agent/CLI review remains unavailable under the previously recorded limits. The archived temporary source crates reference this checkout; update the sim dependency and apple path when reproducing elsewhere.

Next connect physical acquisition and supported movement to recorded body state, preserving continuous roots and bounded orientation changes. Use the shared sampler where appropriate, but do not mistake its valid destination for a verified path. Curved replay, native hull adoption and twenty-brain integration are still required.
