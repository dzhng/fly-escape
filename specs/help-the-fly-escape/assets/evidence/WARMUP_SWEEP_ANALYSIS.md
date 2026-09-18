# Warmup Sweep Experiment: Final Analysis

**Date**: 2026-09-07  
**Question**: Does changing neuron warmup tick count change attraction and/or repulsion effect strength?  
**Specific**: Does warming up MORE make attract/repel STRONGER?

## Executive Summary

**TL;DR**: Warmup tick count does NOT consistently strengthen or weaken attraction/repulsion effects. The relationship between warmup and effect size is non-monotonic and noisy.

## Protocol

| Parameter | Value |
|-----------|-------|
| Warmup values | {0, 30, 60, 120} ticks |
| Seeds per condition | 20 |
| Trial duration | 600 ticks (after warmup) |
| Stimulus types | fruit (excitatory LH), vinegar (inhibitory LH), empty (control) |
| Arena | 400×300, fly starts at (80, 150), stimulus at (320, 150) |
| Initial distance | 240 pixels |
| Metric | Mean distance to stimulus over trial |

## Raw Results

### Control Baseline (Empty Arena)
| Warmup | Mean Distance | Std |
|--------|---------------|-----|
| 0 | 114.6 | 17.1 |
| 30 | 114.3 | 18.4 |
| 60 | 113.2 | 16.2 |
| 120 | 122.4 | 17.6 |

The control baseline shows natural forward drift toward the center-right of the arena (from 240 to ~114-122).

### Fruit (Excitatory LH Injection)
| Warmup | Mean Distance | Δ vs Control | Cohen's d |
|--------|---------------|--------------|-----------|
| 0 | 137.3 | +22.7 | -1.36 |
| 30 | 134.7 | +20.4 | -1.14 |
| 60 | 135.7 | +22.5 | -1.41 |
| 120 | 132.8 | +10.4 | -0.61 |

**Interpretation**: Negative d means fruit condition stays FARTHER from stimulus than control. This is **unexpected** — excitatory LH injection appears to cause avoidance rather than attraction.

### Vinegar (Inhibitory LH Injection)
| Warmup | Mean Distance | Δ vs Control | Cohen's d |
|--------|---------------|--------------|-----------|
| 0 | 112.5 | -2.1 | -0.12 |
| 30 | 114.0 | -0.3 | -0.01 |
| 60 | 121.2 | +8.0 | +0.42 |
| 120 | 118.7 | -3.7 | -0.19 |

**Interpretation**: Small/inconsistent effects. Only warmup=60 shows any repulsion (d=0.42).

## Answers to Research Questions

### 1. Does longer warmup strengthen ATTRACTION?

**NO** — Effect sizes by warmup show NO monotonic relationship:
```
Warmup 0:   d = -1.36
Warmup 30:  d = -1.14  
Warmup 60:  d = -1.41  
Warmup 120: d = -0.61
```

The effect is strongest at warmup=60, weakest at warmup=120. No clear "more warmup = stronger effect" pattern.

### 2. Does longer warmup strengthen REPULSION?

**NO** — Effect sizes show no clear trend:
```
Warmup 0:   d = -0.12
Warmup 30:  d = -0.01
Warmup 60:  d = +0.42
Warmup 120: d = -0.19
```

Only warmup=60 shows any positive repulsion effect. Otherwise null/noise.

### 3. Is warmup=60 "enough" (diminishing returns)?

**NOT APPLICABLE** — There's no consistent warmup benefit to plateau. Warmup=60 happens to show the strongest effects for both fruit (d=-1.41) and vinegar (d=+0.42), but warmup=120 shows WEAKER effects, not similar effects.

### 4. Is vinegar repulsion null at all warmups?

**MOSTLY YES** — Max effect d=0.42 (at warmup=60 only). At other warmups, d ≤ 0.12. This is consistent with the turn-DN pathway miss hypothesis from ATTRACT_VS_REPEL.md:
- Inhibitory LH→DN pathway may suppress motor output without asymmetric turn
- Result: Slowing/confusion rather than directed avoidance

## Unexpected Finding: Fruit Causes Avoidance

The most surprising result is that **fruit odor injection causes the fly to stay FARTHER from the stimulus**, not closer. Possible explanations:

1. **Bilateral injection imbalance**: The excitatory LH injection may be creating asymmetric DN activation that causes turning away from the direct approach path
2. **Thrust disruption**: Strong bilateral injection may suppress overall locomotion, causing the fly to drift rather than approach
3. **Graph pathway issue**: The LH→DN pathway may not create the expected ipsilateral bias for attraction

This warrants further investigation outside the warmup question.

## Conclusion

**Warmup tick count does NOT systematically affect attraction/repulsion strength.** The relationship is non-monotonic and noisy:

- Warmup=60 happens to show the strongest effects
- Warmup=120 shows the WEAKEST effects (not strongest as "more warmup = stronger" would predict)
- Warmup=0 shows intermediate effects

**Recommendation**: The current default of warmup=60 is fine, but not because of any "stabilization" benefit — the neural dynamics appear to respond similarly regardless of warmup period. The LIF baseline activity reaches approximate steady-state quickly.

## Evidence Files

- `warmup_sweep_results.json` — Full trial-level data (240 trials)
- `warmup_sweep_report.md` — Auto-generated summary
- `WARMUP_SWEEP_ANALYSIS.md` — This detailed analysis
