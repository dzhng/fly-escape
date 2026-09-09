# Final campaign integration choices

| Choice | Basis and consequence |
| --- | --- |
| Enable existing campaign vision; omit a new lighting puzzle and additional UI | User explicitly narrowed the finish criterion to gameplay regression checks; noticeable effects are not required. |
| Share authored emitters between scene and field exports | One location owner prevents future scene/sensing drift; camera and renderer state stay out of simulation. |
| Keep gain 3 and modeled source rates/radii | Reuses validated neural inputs and the already tested physical-light configuration. Values are game assumptions, not biological calibration. |
| Reuse full native results only after deep equality of actual exports | Avoids repeating identical full simulations while proving integration uses the recorded inputs. Browser verification independently checks production hashes. |
| Preserve gameplay settings and About | No balance retuning to chase escape counts; random browser outcomes and limited fixed-seed results do not support an easier/harder claim. |
| Use a Bun browser-test command | Campaign exports include TypeScript imports that standard Node cannot resolve. The explicit package command fixes the review finding without adding a loader. |

Earlier choices remain recorded in the completed [retry](../fast-retries/choices.md), [directional sensing](../directional-vision/choices.md) and [neural vision](../neural-vision/choices.md) ledgers. Their circuit and replay decisions still apply; the campaign-disabled checkpoint is superseded by this integration.
