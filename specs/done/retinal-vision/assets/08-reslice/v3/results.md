# Spatial v3 result

**FAIL under the frozen voltage-primary criterion.** The single reserved-seed
run completed all conditions. Seven of nine contrasts passed; white−gray128 and
flight opening−blocker each had zero corrected voltage endpoints. All control
gates passed. Seeds 300–329, all 438 endpoints, and the 7,884-comparison family
remained unchanged.

Corrected voltage endpoint counts in frozen contrast order are
**5, 2, 0, 1, 5, 1, 5, 2, 0**. Secondary spike endpoint counts are
**19, 0, 0, 8, 12, 6, 14, 2, 0**; they do not replace the primary criterion.

[The evidence manifest](../confirmation-08-v3/evidence.json) records every
contrast and the hashes of the losslessly compressed raw report and analysis.
The existing analyzer's exit code 1 represents this preserved failure. No input,
criterion, endpoint or seed was changed after seeing the result; no further run
was started. Figures and additional review were omitted under the user's
explicit stop-tuning and ship instruction. The passed v2 color experiment was
not rerun.
