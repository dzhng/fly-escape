# Gain Sweep Report: Landing + Feeding Behavior

Generated: 2026-09-05T18:16:09.740965

Total trials: 27

## Scientific Honesty Note

**FEEDING GAIN** affects the sugar→proboscis pathway (POST-CONTACT).
- This should affect feeding initiation speed
- It should **NOT** significantly affect landing speed

**OLFACTORY GAIN** affects hunger→approach motivation (PRE-CONTACT).
- This amplifies chemotaxis drive when hungry
- It **SHOULD** affect landing speed (fly approaches faster)

If feeding_gain speeds landing, that would be suspicious.
If olfactory_gain speeds landing, that's biologically plausible.


## Effect of Feeding Gain (sugar→proboscis pathway)

| Feeding Gain | Survival | Mean Land Time | Mean Feed Time | N Landed | N Fed |
|--------------|----------|----------------|----------------|----------|-------|
| 1.0x | 100% | 38.3s ± 33.6 | 42.4s ± 33.6 | 9 | 9 |
| 2.0x | 100% | 42.8s ± 42.8 | 46.9s ± 42.8 | 9 | 9 |
| 4.0x | 100% | 45.7s ± 41.5 | 49.8s ± 41.5 | 9 | 9 |

## Effect of Olfactory Gain (hunger→approach motivation)

| Olfactory Gain | Survival | Mean Land Time | Mean Feed Time | N Landed | N Fed |
|----------------|----------|----------------|----------------|----------|-------|
| 1.0x | 100% | 35.2s ± 27.1 | 39.3s ± 27.1 | 9 | 9 |
| 2.0x | 100% | 42.3s ± 41.1 | 46.4s ± 41.1 | 9 | 9 |
| 4.0x | 100% | 49.3s ± 46.8 | 53.4s ± 46.8 | 9 | 9 |

## Interpretation

**WARNING: Feeding gain appears to affect landing speed** (-19.3% difference).
This is unexpected and may indicate a bug or confounding factor.

**Olfactory gain has weak/no effect on landing speed** (-40.2% difference).
The effect may be masked by other factors (noise, boundary reflections).

## Raw Data

See `gain_sweep_results.csv` for full trial data.