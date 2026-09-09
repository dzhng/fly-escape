# V2 fixed-input neural results

**The color panel passes; the spatial/brightness/occlusion panel fails.** Both ran once with the reviewed source freezes, seeds 200–229, unchanged 438 endpoints, voltage-primary ordering, input/motor exclusions and statistical families. Every control gate passes. No seed, image, coefficient, gain, duration, endpoint or threshold was changed after freezing, and neither panel was rerun.

| Spatial/brightness/occlusion contrast | Corrected voltage endpoints | Corrected spike endpoints | Primary gate |
| --- | ---: | ---: | --- |
| Gray 64 − dark | 4 | 23 | Pass |
| Gray 128 − gray 64 | 1 | 0 | Pass |
| White − gray 128 | 1 | 0 | Pass |
| Left upper − right upper | 0 | 5 | **Fail** |
| Left lower − right lower | 2 | 6 | Pass |
| Left upper − left lower | 0 | 3 | **Fail** |
| Right upper − right lower | 2 | 8 | Pass |
| Floor opening − blocker | 0 | 0 | **Fail** |
| Flight opening − blocker | 2 | 0 | Pass |

The three failed primary contrasts keep the combined panel failed. The upper-patch contrasts have corrected secondary spike responses, but those do not replace the preregistered voltage criterion. The unchanged nine-contrast family uses 7,884 comparisons and critical t=5.4991433043. [Full spatial evidence](confirmation-08-v2/evidence.json) retains every count and gate.

| Matched-color contrast | Corrected voltage endpoints | Corrected spike endpoints | Primary gate |
| --- | ---: | ---: | --- |
| Lower-context A − B | 3 | 14 | Pass |
| Higher-context A − B | 4 | 15 | Pass |

The color family uses 1,752 comparisons and critical t=4.9576041912. Exact brightness, chromatic-off and silencing controls pass, including downstream trajectory equality for the controlled pairs. Both contexts use identical A−B current-difference vectors with 352 differing Tm20 cells and no differing Tm2 cells. The higher context adds100 to R/G while retaining blue, rather than doubling all RGB channels. [Full color evidence](confirmation-09-v2/evidence.json) preserves both outcomes and all descriptive controls.

This is positive fixed-input downstream color evidence for the accepted stronger stimulus. Supported area and chromatic contrast both increased, so the result does not isolate which change addressed the earlier failure. It does not establish physiological color fidelity, anatomical registration or a complete browser/body chain. The original v1 failures remain intact and are not relabeled as passes.

## Complete evidence and verification

The raw reports retain all 61 conditions, all 30 seeds per condition, all 438 endpoint voltage/count measurements and all 40,944 downstream spike counts per seed. The [run verification](run-verification.json) records exact freeze/source/input hashes, both process logs and resource measurements. Every frozen source, analyzer, statistical owner, graph, map and manifest hash still matches. Analysis used the frozen analyzer; its exit codes were 1 for the failed spatial panel and 0 for color.

Reports and analyses are stored losslessly as gzip: 189,307,705 decoded bytes become 31,515,144 stored bytes. Decoded hashes and lengths were checked before deleting the uncompressed duplicates and independently checked again afterward. This is offline evidence storage, not a production replay codec.

Native spatial execution took 481.84 seconds wall time, with 114,573,312 bytes maximum RSS and 87,540,168 bytes peak memory footprint. Color took 324.23 seconds, with 114,802,688 bytes maximum RSS and 87,474,608 bytes peak footprint. These process observations include the streamed-output implementation and final metadata cutover; they are not browser performance measurements or an isolated comparison attributing memory changes to one cause.

All 25 PNGs have [numeric visual telemetry](visual-metrics-v2.json), including exact displayed color checks within one byte. Full endpoint plots remain visible, with separate corrected-only detail panels and self-contained row crops. A fresh reviewer found a current legend overlapping the floor-occlusion zero line; it was moved outside the data area. A second fresh reviewer inspected every final PNG and reported no actionable visible defect. The figures are bound to the decoded report and analysis hashes.

[Spatial full figures](confirmation-08-v2/figures/responses.png), [failed upper comparison](confirmation-08-v2/figures/response-04-crop.png), [failed floor occlusion](confirmation-08-v2/figures/response-08-crop.png), [color full figures](confirmation-09-v2/figures/responses.png), and [exact color inputs](confirmation-09-v2/figures/color-inputs-enlarged.png) expose both positive and negative results.

The next authorized work is input-only feasibility for larger geometric spatial patches. Floor occlusion requires a separately declared physical capture redesign; these failed input bytes cannot be reused or relabeled as new passing evidence. No additional neural run or seed freeze is authorized by these results.

Independent read-only code review found no actionable findings in the outcome distinctions, frozen identities/criteria, archive hashes or figure/input/report/analysis bindings. No v1 helper regression was identified.
