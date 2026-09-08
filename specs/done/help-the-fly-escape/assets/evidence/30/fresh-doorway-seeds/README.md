# Four fresh tuning seeds for the doorway candidate

Twelve unique completed native attempts atf095e06 plus the paced second-house content. Frozen [plans](plans.json), seeds112–115,20flies,3000ticks. The authored speeds are already0.24/0.48, so harness speedScale is1. Same [harness](../second-house-route/second_house_pilot.rs). All identity hashes agree across cells, every attempt completed and every fly has a terminal outcome. Raw reports are compressed under runs/.

| Setup | 112 | 113 | 114 | 115 | Mean |
| --- | --- | --- | --- | --- | --- |
| Empty | 3 | 3 | 4 | 3 | 3.25 |
| Corner fan | 1 | 3 | 4 | 6 | 3.50 |
| Fan and rear vinegars | 4 | 4 | 7 | 4 | 4.75 |

Combined-minus-empty differences are1,1,3,1 (mean1.5, median1). Combined-minus-fan differences are3,1,3,-2 (mean1.25, median2). The candidate beats empty on each fresh seed but is worse than the fan on one. This supports a probabilistic candidate effect; four seeds do not establish final calibration or a player percentile. These are additional tuning seeds, not the untouched final holdout.

The campaign's primary gate compares a reference with a deliberately poor legal placement, not with an empty map. Empty and fan-only controls remain valuable diagnostics; neither replaces the required poor-placement comparison. A poor-placement hypothesis is being tested separately. No star threshold was changed here.

Execution deviation: the delegate started a sequential batch. Root tried to parallelize the remaining seeds, but paused it after it had already entered seed113 and briefly overlapped a second113 batch. Root's batch wrote empty113 before being stopped. Root then completed missing113 cells and all114/115 cells; the delegate detected and killed its paused duplicate before it wrote, verifying the existing record hash was unchanged. Exactly12 distinct records survived with matching inputs; extra interrupted computation occurred, so this was not exactly12 attempt starts. Root's later kill found the original already gone. This coordination was unnecessarily complex: future batches give distinct seeds to at most two or three processes before starting. Suspended/concurrent timings are not performance evidence. No paused worker remains.
