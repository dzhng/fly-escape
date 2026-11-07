# Warmup Sweep Experiment Results

## Question
Does changing neuron warmup tick count change attraction and/or repulsion effect strength?

## Protocol
- Warmup values tested: [0, 30, 60, 120]
- Seeds per condition: 20
- Trial duration: 600 ticks after warmup
- Stimulus types: fruit (attract), vinegar (repel), empty (control)
- Pure graph chemotaxis (no hacks)

## Results

### Fruit Attraction
| Warmup | Mean Distance | Δ vs Control | Effect Size (d) |
|--------|---------------|--------------|------------------|
| 0 | 137.3 | -22.7 | -1.36 |
| 30 | 134.7 | -20.4 | -1.14 |
| 60 | 135.7 | -22.5 | -1.41 |
| 120 | 132.8 | -10.4 | -0.61 |

### Vinegar Repulsion
| Warmup | Mean Distance | Δ vs Control | Effect Size (d) |
|--------|---------------|--------------|------------------|
| 0 | 112.5 | -2.2 | -0.12 |
| 30 | 114.0 | -0.3 | -0.01 |
| 60 | 121.2 | +8.0 | 0.42 |
| 120 | 118.7 | -3.7 | -0.19 |

## Conclusions

1. **Attraction trend**: INCREASING
   - Strongest effect at warmup=120
   - Effect sizes: {0: '-1.36', 30: '-1.14', 60: '-1.41', 120: '-0.61'}

2. **Repulsion trend**: NO CLEAR TREND
   - Strongest effect at warmup=60
   - Effect sizes: {0: '-0.12', 30: '-0.01', 60: '0.42', 120: '-0.19'}

3. **Is warmup=60 enough?**
   - Fruit: Δd from 60→120 = 0.80
   - Vinegar: Δd from 60→120 = -0.61

4. **Vinegar null at all warmups?** NO
