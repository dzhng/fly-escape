# Existing-fan viability pilot

This candidate adds four existing catalog fans to the compact five-room level while freezing its body parameters, neural tuning, starting poses, scent placements and duration. It tests physical wind assistance as an alternative to relying on weak scent-only placement effects. No new steering, controller, graph change or fan strength/radius override is introduced.

The reference places four fans along the route facing +X. Poor uses the same scent and fan positions, rotating only the fans by π. The no-fans control retains all six scent placements. Wind both advects odor and contributes physical body drift in the existing simulation, so this is a combined tool-effect comparison, not isolated proof of neural foraging.

An initial fan at (0.3,1.0) overlapped spawn footprints and was rejected before any simulation. That failed content is preserved. Moving only this fan to (1.3,1.0) produced a legal candidate; the remaining fan positions are (1.9,1.0), (3.5,1.0) and (5.1,1.0). Existing core placement validation accepts both complete configurations. Catalog reach 3, half-width 0.75 and speed 0.5 remain unchanged.

Seed 1000 yielded reference 8, poor 0 and no-fans 5. This positive +3 versus no-fans triggered the predeclared expansion to tuning seeds 1001 and 1002. The remaining-seeds probe skips the already measured seed 1000, so each arm runs once per seed. No held-out seed is used. Exact temporary probe patches and candidate/source hashes are retained; production content is unchanged.

| Tuning seed | Reference | Reversed fans | No fans, same scents |
|---|---:|---:|---:|
| 1000 | 8 | 0 | 5 |
| 1001 | 10 | 0 | 5 |
| 1002 | 12 | 2 | 4 |

Median reference benefit is +10 escapes versus reversed fans and +5 versus no fans. All three reference attempts reach at least one star (indeed two). This is a positive viability signal for a candidate fan-assisted first level, and justifies reviewing this exact content before a frozen larger validation. No more pilot adjustments were made. The +4/20 placement difference and 27/30 reliability criteria remain unchanged; a three-seed pilot cannot accept the level or campaign. Browser visual, UI and performance gates are outside this native content pilot. No Preview opened.

The temporary example was restored exactly before commit. Core source hashes and body/field/neural configurations match the base; assertions confirmed only fan inventory/transforms differ from production content and all arms retain the same scent placements. Existing Graph/Attempt validation and outcomes produced every observation. Build identity is shared across the arms; different probe hashes record the initial and remaining seed selectors.

## Frozen validation in progress

The positive pilot met both median comparisons. Parent authorized freezing this exact candidate and all 30 tuning pairs before any held-out run. frozen-candidate.json differs only by frozen=true. The explicit gate requires 30 complete tuning pairs, at least 27 one-star reference attempts, and median reference benefit of at least four escapes against both reversed fans and no fans. No further content tuning is allowed during either batch.

## Full tuning gate passed

All 30 tuning seeds (1000–1029) completed all three arms. Reference earned at least one star in 30/30 attempts, with median 10 escapes. Median paired benefit is +8.5 over reversed fans and +5 over identical scents without fans. Both four-escape comparisons and the 27/30 reliability gate pass. Exact frozen content, runtime build and probe identities are retained in tuning-gate.json and the full tuning report. The disjoint held-out batch may now run without changing content or executable. This is tuning acceptance only, not campaign or release acceptance.

Native and browser build IDs are not interchangeable: build.rs includes compiler and target. core-source-identity.json confirms every core source/build-input byte equals the integrated root at the recorded commit, but does not establish cross-target numerical identity. Browser paired-seed verification remains required before accepting this level.

[Browser transfer evidence](wasm/review.md) records all nine matching WASM/native comparisons on the first three tuning seeds. This closes the bounded content-transfer check, while production campaign UI, held-out reliability and human route review remain separate.
