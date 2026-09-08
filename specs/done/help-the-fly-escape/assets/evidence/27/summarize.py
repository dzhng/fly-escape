import json, statistics, sys, hashlib, gzip
from pathlib import Path
src, dest = map(Path, sys.argv[1:3])
r = json.loads(src.read_text())
rows = r['rows']
index = {(x['scenario'], o['physical'], o['phase'], o['seed'], o['mirror'], o['enabled'], o['silenced']): o
         for x in rows for o in [x['observation']]}
assert len(index) == len(rows), 'duplicate observations'
scenarios = sorted(set(k[0] for k in index))
seeds = sorted(set(k[3] for k in index))
assert seeds == list(range(r['seedCount']))
assert len(index) == len(scenarios)*2*2*len(seeds)*6
controls = 0
results = []
for scenario in scenarios:
    expected = 1 if scenario in ['excitatoryOdor', 'lamp'] else -1
    for physical in [False, True]:
        for phase in [0, 0.125]:
            paired, active, side_deltas = [], [], {1: [], -1: []}
            for seed in seeds:
                baseline = index[scenario, physical, phase, seed, 1, False, False]
                neutral_ablated = index[scenario, physical, phase, seed, 1, False, True]
                deltas = {}
                for mirror in [1, -1]:
                    enabled = index[scenario, physical, phase, seed, mirror, True, False]
                    ablated = index[scenario, physical, phase, seed, mirror, True, True]
                    assert len(ablated['ticks']) == len(neutral_ablated['ticks']) == 100
                    assert all(a['motor']==b['motor'] and a['pose']==b['pose'] and a['effectiveCurrentSum']==0
                               for a,b in zip(ablated['ticks'],neutral_ablated['ticks']))
                    controls += 1
                    deltas[mirror] = enabled['meanTurn']-baseline['meanTurn']
                    side_deltas[mirror].append(deltas[mirror])
                    active.append(enabled['effectiveActiveTicks'])
                paired.append(expected*(deltas[1]-deltas[-1])/2)
            mean = statistics.mean(paired)
            ci = [mean-2.04523*statistics.stdev(paired)/len(seeds)**0.5,
                  mean+2.04523*statistics.stdev(paired)/len(seeds)**0.5] if len(seeds)==30 else None
            results.append({'scenario': scenario, 'physical': physical, 'phase': phase,
                            'pairedSeeds': len(seeds), 'expectedSignedMeanTurnDifference': mean,
                            'descriptive95PercentTInterval': ci,
                            'positiveSeedDifferences': sum(v>0 for v in paired),
                            'meanActiveTicks': statistics.mean(active),
                            'sideMeanDifferences': {str(k):statistics.mean(v) for k,v in side_deltas.items()},
                            'pairedDifferences': paired})
summary = {k:r[k] for k in ['graphHash','manifestHash','simulationBuildId','probeSourceHash','sensorySourceHash','seedCount','scenarioGroup','elapsedSeconds']}
summary.update({'relativeContrastCutoff':0.0001, 'rawSha256':hashlib.sha256(src.read_bytes()).hexdigest(),
                'results':results, 'exactSilencedNeutralComparisons':controls,
                'interpretation':'Paired mirror average per seed, signed positive for the predeclared response. t(29) intervals are descriptive, not multiplicity-adjusted. Motor response is not campaign success.'})
dest.mkdir(parents=True, exist_ok=True)
(dest/(r['scenarioGroup']+'-confirm30-summary.json')).write_text(json.dumps(summary,indent=2)+'\n')
with gzip.GzipFile(filename=str(dest/(r['scenarioGroup']+'-confirm30-raw.json.gz')),mode='wb',mtime=0) as f:
    f.write(json.dumps(r,separators=(',',':')).encode())
for row in results:
    if row['physical']: print({k:v for k,v in row.items() if k!='pairedDifferences'})
