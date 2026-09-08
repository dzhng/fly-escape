# Prepared-start pilot: no placement-benefit signal

Seed 1000, real Graph + Attempt, 20 flies, current compact scene at gain 8 and heading 0.4. The copied content is the house agent's a0600da candidate, held identical across conditions. Only reference and empty placements ran; no held-out seed was used.

| Startup | Reference escapes | Empty escapes | Reference minus empty |
|---|---:|---:|---:|
| Cold | 5 | 6 | -1 |
| Prepared | 1 | 2 | -1 |

Preparation settled fields for 100 × 0.1 seconds without bodies, then advanced each real brain for 60 ticks at its fixed initial body position. Injection used the canonical cue adapter, readout exclusion, pathway gains and taste-on-contact condition. Fields stayed fixed during brain warming. Body mode, position, reserve and attempt clock did not advance. Noise streams advanced with those neural steps. This tests the combined prepared initialization, not field settlement alone or a noise-phase-matched causal contrast.

Both arms lost four escapes; placement benefit stayed -1. There is no positive pilot signal to justify the predeclared expansion to three tuning seeds, so the diagnostic stops here. One seed cannot establish a general harmful startup effect, and no warmed initialization is recommended for production.

The cold result reproduces the prior gain-8 seed-1000 reference/empty result. Exact temporary probe and initialization patches, content, source SHA-256 values and complete per-arm records are retained here. Apply probe.patch to the recorded base for cold reproduction, then warm-initialization.patch for prepared reproduction; run campaign_probe with the saved content, tuning, count 1 and --empty-control. Report firstTickSeconds includes construction/warm-up; neither it nor concurrent native runtime is a browser performance claim. Warm-up neural work is included in construction wall time and is outside the attempt's recorded tick budget.

Both temporary Rust modifications were restored byte-for-byte to their base before committing. No runtime code, graph, sensory mapping, body steering or production configuration changed. Source review confirms canonical current construction with frozen body and unchanged motor ownership. This remains diagnostic evidence under open slice 15.
