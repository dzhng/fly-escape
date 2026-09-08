"""Descriptive statistics over the 30 paired seeds in unilateral.json.

No inference beyond 'these 30 seeds of this model'. Intervals are ordinary two-sided 95%
t intervals on the seed-level mean; scipy is unavailable here so the critical value for
df = 29 is written out literally.
"""
import json
from math import sqrt
from pathlib import Path

OUT = Path('/tmp/fly-da2-unilateral-output')
T_CRIT_DF29 = 2.045229642132703  # two-sided 95%, df = 30 - 1
data = json.loads((OUT / 'unilateral.json').read_text())
obs = data['observations']
assert len(obs) == 30, len(obs)


def describe(values):
    n = len(values)
    mean = sum(values) / n
    sd = sqrt(sum((v - mean) ** 2 for v in values) / (n - 1))
    se = sd / sqrt(n)
    return dict(n=n, mean=mean, sd=sd, se=se,
                ci95=[mean - T_CRIT_DF29 * se, mean + T_CRIT_DF29 * se],
                min=min(values), max=max(values),
                positiveSeeds=sum(v > 0 for v in values),
                negativeSeeds=sum(v < 0 for v in values),
                zeroSeeds=sum(v == 0 for v in values))


summary = {'primary': {}, 'turnGroups': {}, 'receptorAndPnLaterality': {}}
for key in ('leftMinusNone', 'rightMinusNone', 'leftMinusRight'):
    summary['primary'][key] = describe([o['primary'][key] for o in obs])

# Turning groups themselves, so the bias term can be decomposed per side.
for arm in ('none', 'left', 'right'):
    for phase in ('before', 'during', 'after'):
        for group in ('turnL', 'turnR'):
            k = f'{phase}.{group}SpikeFraction'
            summary['turnGroups'][f'{arm}.{k}'] = describe(
                [o['arms'][arm]['readouts'][k] for o in obs])
    for group in ('turnL', 'turnR'):
        if arm == 'none':
            continue
        k = f'during.{group}SpikeFraction'
        summary['turnGroups'][f'{arm}MinusNone.{k}'] = describe(
            [o['arms'][arm]['readouts'][k] - o['arms']['none']['readouts'][k] for o in obs])

# Receptor and PN evoked rates, reported per side and per arm without any causal claim.
for arm in ('none', 'left', 'right'):
    for group in ('ornL', 'ornR', 'ornunknown', 'ornAll', 'pnL', 'pnR', 'pnAll'):
        summary['receptorAndPnLaterality'][f'{arm}.evokedHz.{group}'] = describe(
            [o['arms'][arm]['evokedHz'][group] for o in obs])
    if arm != 'none':
        for group in ('pnL', 'pnR'):
            summary['receptorAndPnLaterality'][f'{arm}MinusNone.evokedHz.{group}'] = describe(
                [o['arms'][arm]['evokedHz'][group] - o['arms']['none']['evokedHz'][group] for o in obs])

# PN laterality expressed the same way as the turning bias: right side minus left side.
for arm in ('none', 'left', 'right'):
    summary['receptorAndPnLaterality'][f'{arm}.evokedHz.pnR-minus-pnL'] = describe(
        [o['arms'][arm]['evokedHz']['pnR'] - o['arms'][arm]['evokedHz']['pnL'] for o in obs])
pn_bias = {a: [o['arms'][a]['evokedHz']['pnR'] - o['arms'][a]['evokedHz']['pnL'] for o in obs]
           for a in ('none', 'left', 'right')}
for arm in ('left', 'right'):
    summary['receptorAndPnLaterality'][f'{arm}MinusNone.evokedHz.pnR-minus-pnL'] = describe(
        [a - n for a, n in zip(pn_bias[arm], pn_bias['none'])])
summary['receptorAndPnLaterality']['leftMinusRight.evokedHz.pnR-minus-pnL'] = describe(
    [l - r for l, r in zip(pn_bias['left'], pn_bias['right'])])

summary['verification'] = data['verification']
summary['protocol'] = data['protocol']
summary['limits'] = data['limits']
(OUT / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')


def line(label, s):
    return (f'{label:<46} mean {s["mean"]:+.4e}  95% CI [{s["ci95"][0]:+.4e}, {s["ci95"][1]:+.4e}]'
            f'  sd {s["sd"]:.3e}  +{s["positiveSeeds"]}/-{s["negativeSeeds"]}/0:{s["zeroSeeds"]}')


print('PRIMARY: during-pulse (turnR - turnL) spike fraction, arm minus same-seed no-current arm')
for k, s in summary['primary'].items():
    print(' ', line(k, s))
print('\nTURN GROUPS')
for k, s in summary['turnGroups'].items():
    if 'MinusNone' in k or k.startswith('none.during'):
        print(' ', line(k, s))
print('\nRECEPTOR / PN EVOKED (during minus before, spikes/s, unvalidated 1 ms/step)')
for k, s in summary['receptorAndPnLaterality'].items():
    print(' ', line(k, s))
