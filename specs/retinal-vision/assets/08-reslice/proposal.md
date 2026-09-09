# Supported-area retinal input proposal

**Input-only proposal. No Brain was constructed or stepped.** Review this manifest and its native-current evidence before authorizing a new preregistration or run. The original 08/09 diagnostic and held-out failures remain unchanged.

The [exact proposal](proposal.json) retains gain 3, the map and its coefficients/transfer, all 438 endpoints and exclusions, LIF parameters, initial-state policy, 60 warmup steps and 100 measured steps. Proposed fresh seeds are 200–229, disjoint from 1–6 and 100–129. Both original contrast families remain intact: nine spatial/brightness/occlusion contrasts with 7,884 comparisons, and two color contrasts with 1,752 comparisons. Voltage remains primary; spike count remains secondary. No failed contrast is removed. In particular, wider spatial patches do not by themselves resolve the unchanged brightness or occlusion gates.

## Broader supported area

Each old single-sample anchor becomes the nearest 32 jointly supported samples, ordered only by squared frozen image-plane distance and sample index. The anchors remain L163, L562, R170 and R567. Upper/lower patches are disjoint within each eye. The left eye has 141 jointly supported samples and the right 171; 32 is a proposed moderate patch size, not an optimized neural parameter. Each patch covers 4.44% of its 721-sample eye. Missing supported samples remain black, so these are irregular supported patches rather than filled retinal discs. Equal area does not imply equal shape or equal neuron count.

| Patch | Stimulated Tm2 inputs | Delivered dose | Maximum cell current |
| --- | ---: | ---: | ---: |
| Left upper | 30 | 16.03131115 | 1.12934047 |
| Left lower | 38 | 16.03131115 | 1.21289525 |
| Right upper | 48 | 16.03131115 | 1.38428262 |
| Right lower | 41 | 16.03131115 | 1.50293542 |

All four gray-128 patches keep Tm20 off. The four paired spatial contrasts change 78, 79, 68 and 89 injected cells, respectively, with L1 current difference 32.06262231 each. The old differences changed two cells with L1 1.00195695. This increases supported stimulus area and dose within the existing adapter budget; it does not promise downstream significance. Dose matching follows the frozen normalized support columns and is verified from actual native currents, not assumed from pixel count.

## Color without a changing contrast at higher brightness

The proposed patterns swap A/B across the same two 32-sample patches per eye. At the lower level, A=[66,120,2] and B=[134,80,198]. At the higher level, A=[166,220,2] and B=[234,180,198]. Both pairs have exactly equal diagnostic luminance and exactly equal Tm2 vectors in the native adapter. Their blue values are held fixed between levels, making the complete A−B current-difference vector exactly identical between levels. This is a brightness-context manipulation by adding 100 to R and G, **not** an integer doubling of all RGB channels.

| Property | Lower brightness | Higher brightness |
| --- | ---: | ---: |
| Diagnostic luminance, byte-equivalent | 100 | 192.78 |
| Stimulated inputs per pattern | 509 | 509 |
| Inputs differing between swaps | 352 Tm20, 0 Tm2 | 352 Tm20, 0 Tm2 |
| A−B current L1 | 63.72015946 | 63.72015946 |
| Total current per pattern | 89.78375292 | 110.56460264 |
| Maximum cell current | 1.31868132 | 1.80573248 |

The pair is selected from a finite RGB8/gamut-only domain: all integer colors with diagnostic luminance 100/255 and R,G≤155, preserving room for the fixed +100 R/G step. Seventy-eight candidate pairs were screened through the native adapter; seventeen had exact native brightness equality at both levels. The chosen pair maximizes blue transfer contrast among those seventeen, with a lexicographic RGB tie-break. [The entire native screen](candidate-screen.json) retains both rejected and eligible candidates. An initial Python-exact candidate failed native equality by floating-point rounding and was rejected before any Brain run. No neural outcome enters this selection. The proposal changes both supported area and chromatic stimulus contrast, so a future response would not isolate which change addressed the earlier failure; it would test the explicitly stronger supplied stimulus. The original color pair is retained in the screen but fails exact native brightness equality after this particular +100 R/G shift.

The Tm20-off pairs have exactly identical full current vectors. Pattern repeats and silenced/zero-input controls also match exactly at the input boundary. Per-eye/channel doses match within the existing 1e-9 tolerance. [Evidence](evidence.json) records every condition, contrast and control; [full current vectors](currents.json) preserve requested and delivered currents in the frozen entry order. Trajectory equality remains untested until a future authorized neural run. All current totals remain below the unchanged map's gain-3 bound of 440, and every cell remains below 3.

Grayscale and uniform fields remain descriptive controls. The higher grayscale diagnostic uses RGB=[193,193,193], the nearest RGB8 neutral value to 192.78; it is not an exact luminance match and is not an acceptance control. The exact brightness controls are the Tm20-off A/B pairs. Physiological color fidelity, optical registration and motor signs are not inferred from these inputs.

## Evidence ownership and next boundary

The native helper directly calls [the shared adapter](../../../../crates/sim/src/sensory.rs) and loads the unchanged graph only to validate the map. Its dependency lock, source hashes, graph/map/manifest hashes, all RGB bytes and full native outputs are retained. It imports no Brain and has no neural execution path. The visual [input overview](proposed-inputs.png) is drawn from those bytes, displaying linear RGB8 through the sRGB transfer; both eye axes are image right/down without mirroring.

The current experiment runner/analyzer intentionally reject these new seed/protocol values. Before any run, review the size/color choices, write and freeze the new protocol, and make an explicit runner/analyzer version change that preserves the old evidence checks. This proposal is not a runnable experiment manifest and `runAuthorized` remains false. Do not retrofit it into the old frozen directories.

To reproduce input evidence, run `prepare.py`, then the isolated native Cargo helper with repository-root and proposal-JSON arguments, then `summarize.py`. The first preparation without `candidate-screen.json` is only a candidate screen; native exact checks must select a pair before final evidence can pass. The checked-in screen is tied to the same native helper/map identities. No command here runs a Brain.
