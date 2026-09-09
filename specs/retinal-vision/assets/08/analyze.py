"""Analyze frozen supplied-byte retinal experiments using the existing paired endpoint owner."""
import argparse
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
from connectome.analyze_neural_vision import paired_cells, require, finite_vector


def protocol_seeds(frozen):
    key = (frozen["protocol"], frozen["pack"]["version"], frozen["phase"])
    panels = {
        ("retinal-fixed-input-diagnostic-v1", 1, "diagnostic"): list(range(1, 7)),
        ("retinal-fixed-input-diagnostic-v1", 1, "confirmation"): list(range(100, 130)),
        ("retinal-supported-area-confirmation-v2", 2, "reslice-confirmation"): list(range(200, 230)),
    }
    require(key in panels, "Unsupported protocol/version/phase combination")
    if frozen["pack"]["version"] == 2:
        checks = frozen["resliceChecks"]
        require(all(checks[k] is True for k in ["retainedPopulationsExactlyEqual", "acceptedCurrentVectorsExactlyEqual",
            "exactBrightnessControls", "colorContrastAcrossContextsExactlyEqual"]), "Reslice input contract not verified")
        require(checks["manifestHash"] == frozen["identities"]["manifestHash"] == frozen["pack"]["reslice"]["manifestSha256"], "Reslice manifest differs")
        require(len(frozen["endpoints"]) == 438, "Reslice changed endpoint population")
    return panels[key]


def analyze(report, freeze_bytes):
    frozen = report["frozen"]
    require(hashlib.sha256(freeze_bytes).hexdigest() == report["freezeHash"] and json.loads(freeze_bytes) == frozen,
            "Freeze identity mismatch")
    require(frozen["gain"] == 3 and
            frozen["warmupTicks"] == 60 and frozen["measuredTicks"] == 100, "Wrong frozen protocol")
    seeds = protocol_seeds(frozen)
    require(frozen["seeds"] == seeds, "Wrong seed panel")
    populations = {name: frozen[name] for name in ["inputs", "endpoints", "downstream", "motorReadouts"]}
    for name, indices in populations.items():
        require(indices == sorted(set(indices)) and indices and all(type(i) is int and i >= 0 for i in indices), f"Invalid {name}")
    require(len(frozen["inputs"]) == 1176, "Wrong full injected population")
    excluded = set(frozen["inputs"]) | set(frozen["motorReadouts"])
    require(not excluded & set(frozen["downstream"]) and set(frozen["endpoints"]) <= set(frozen["downstream"]), "Endpoint exclusion failure")
    names = [c["name"] for c in frozen["pack"]["conditions"]]
    conditions = {c["name"]: c for c in report["conditions"]}
    require(len(names) == len(set(names)) and [c["name"] for c in report["conditions"]] == names, "Incomplete or reordered condition panel")
    spec = {c["name"]: c for c in frozen["pack"]["conditions"]}
    warmups = {}
    for name, condition in conditions.items():
        require(condition["rgbSha256"] == spec[name]["rgbSha256"], "RGB identity mismatch")
        observations = condition["observations"]
        require([o["seed"] for o in observations] == seeds, "Missing/reordered seed")
        totals = condition["downstreamSpikeTotalsByIndex"]
        require(len(totals) == len(frozen["downstream"]) and all(type(v) is int and v >= 0 for v in totals), "Incomplete downstream counts")
        require(sum(totals) == sum(o["downstreamSpikeCount"] for o in observations), "Downstream count accounting mismatch")
        for o in observations:
            finite_vector(o["endpointMeanVoltage"], len(frozen["endpoints"]), "endpoint mean voltage")
            require(len(o["endpointSpikeCount"]) == len(frozen["endpoints"]) and
                    all(type(v) is int and 0 <= v <= 100 for v in o["endpointSpikeCount"]), "Invalid endpoint spikes")
            require(len(o["downstreamPerTick"]) == 100 and sum(o["downstreamPerTick"]) == o["downstreamSpikeCount"], "Incomplete downstream timeline")
            require(len(o["downstreamSpikeCounts"]) == len(frozen["downstream"]) and
                    all(type(v) is int and 0 <= v <= 100 for v in o["downstreamSpikeCounts"]) and
                    sum(o["downstreamSpikeCounts"]) == o["downstreamSpikeCount"], "Incomplete per-seed downstream counts")
            for field in ["initialStateHash", "warmupStateHash", "neuralTrajectoryHash", "downstreamTrajectoryHash", "inputSpikeTrajectoryHash"]:
                require(isinstance(o[field], str) and len(o[field]) == 64 and set(o[field]) <= set("0123456789abcdef"), "Invalid neural state hash")
            state = (o["brainSeed"], o["initialStateHash"], o["warmupStateHash"])
            require(warmups.setdefault(o["seed"], state) == state, "Paired initial/warmup states differ")
    contrasts = []
    voltage_floor = frozen["voltageResponseFloor"]
    require(voltage_floor == 1e-9, "Wrong frozen numerical voltage floor")
    count = 2 * len(frozen["pack"]["primaryContrasts"]) * len(frozen["endpoints"])
    for a, b in frozen["pack"]["primaryContrasts"]:
        left, right = conditions[a]["observations"], conditions[b]["observations"]
        differences = np.asarray([o["endpointMeanVoltage"] for o in left]) - np.asarray([o["endpointMeanVoltage"] for o in right])
        critical, cells = paired_cells(differences, frozen["endpoints"], count)
        for cell in cells:
            cell["responseAboveFloor"] = cell["interval"][0] > voltage_floor or cell["interval"][1] < -voltage_floor
        spike_difference = np.asarray([o["endpointSpikeCount"] for o in left]) - np.asarray([o["endpointSpikeCount"] for o in right])
        _, spike_cells = paired_cells(spike_difference, frozen["endpoints"], count)
        voltage_passed = any(c["responseAboveFloor"] for c in cells)
        spikes_passed = any(c["significant"] for c in spike_cells)
        contrasts.append(dict(a=a, b=b, passed=voltage_passed, cells=cells, spikeCells=spike_cells,
            membraneVoltagePassed=voltage_passed, spikeCountPassed=spikes_passed, subthresholdEndpointOnly=voltage_passed and not spikes_passed,
            correctedEndpointCount=sum(c["responseAboveFloor"] for c in cells), correctedSpikingEndpointCount=sum(c["significant"] for c in spike_cells), endpointCountWithAnySpikeDifference=int(np.any(spike_difference != 0, axis=0).sum()),
            downstreamSpikeDifferences=[x["downstreamSpikeCount"] - y["downstreamSpikeCount"] for x, y in zip(left, right)],
            downstreamCellCountWithDifferentAggregatedSpikes=sum(x != y for x, y in zip(conditions[a]["downstreamSpikeTotalsByIndex"], conditions[b]["downstreamSpikeTotalsByIndex"])),
            perSeedMaximumVoltageDifference=np.max(np.abs(differences), axis=1).tolist()))
    gates = [dict(check, source="native pre-run control validation") for check in frozen["controlChecks"]]
    for a, b in frozen["pack"]["exactPairs"]:
        pairs = list(zip(conditions[a]["observations"], conditions[b]["observations"]))
        equal = [x["neuralTrajectoryHash"] == y["neuralTrajectoryHash"] for x, y in pairs]
        gates.append(dict(kind="exact neural repeat/control", a=a, b=b, passed=all(equal), perSeedEqual=equal))
    for a, b in frozen["pack"]["chromaticOffPairs"]:
        pairs = list(zip(conditions[a]["observations"], conditions[b]["observations"]))
        errors = [max(abs(x-y) for x, y in zip(left["endpointMeanVoltage"], right["endpointMeanVoltage"])) for left, right in pairs]
        equal_spikes = [left["endpointSpikeCount"] == right["endpointSpikeCount"] and left["downstreamSpikeCount"] == right["downstreamSpikeCount"] for left, right in pairs]
        exact_downstream = [left["downstreamTrajectoryHash"] == right["downstreamTrajectoryHash"] for left, right in pairs]
        equal_totals = conditions[a]["downstreamSpikeTotalsByIndex"] == conditions[b]["downstreamSpikeTotalsByIndex"]
        gates.append(dict(kind="chromatic-off downstream equality", a=a, b=b,
            passed=max(errors) <= 1e-12 and all(equal_spikes) and equal_totals and all(exact_downstream), maximumVoltageDifferences=errors,
            perSeedSpikeCountsEqual=equal_spikes, perSeedDownstreamTrajectoriesEqual=exact_downstream, allDownstreamAggregatedCountsEqual=equal_totals))
    descriptive = []
    def describe(a, b, purpose):
        pairs = list(zip(conditions[a]["observations"], conditions[b]["observations"]))
        descriptive.append(dict(a=a, b=b, purpose=purpose,
            perSeedDownstreamTrajectoriesEqual=[x["downstreamTrajectoryHash"] == y["downstreamTrajectoryHash"] for x, y in pairs],
            perSeedMaximumEndpointVoltageDifference=[max(abs(v-w) for v, w in zip(x["endpointMeanVoltage"], y["endpointMeanVoltage"])) for x, y in pairs],
            perSeedDownstreamSpikeDifference=[x["downstreamSpikeCount"] - y["downstreamSpikeCount"] for x, y in pairs],
            perSeedDownstreamCellsWithDifferentSpikeCount=[sum(v != w for v, w in zip(x["downstreamSpikeCounts"], y["downstreamSpikeCounts"])) for x, y in pairs]))
    for name, condition in spec.items():
        if condition["permuteRows"]:
            describe(name.removesuffix("-permuted"), name, "Fixed within-eye/channel row permutation; no significance claim")
    for a, b in frozen["pack"]["primaryContrasts"]:
        if a + "-permuted" in conditions and b + "-permuted" in conditions:
            describe(a + "-permuted", b + "-permuted", "Counterbalanced contrast under the fixed row permutation")
    if frozen["slice"] == "08":
        for name in conditions:
            if name.startswith(("scene-", "quality-")):
                describe(name, "dark", "Supplied scene RGB versus zero RGB; mixed optics/pose/dose, not an isolated causal scene contrast")
    else:
        for scale in [1, 2]:
            describe(f"uniform-color-{scale}-a", f"uniform-color-{scale}-b", "Equal brightness uniform colors change total blue dose; diagnostic only")
            describe(f"color-{scale}-a", f"color-{scale}-gray", "Original color pattern versus grayscale; both are supplied exact RGB8 images")
            describe(f"color-{scale}-b", f"color-{scale}-gray", "Swapped color pattern versus the same grayscale image")
    summary = []
    for name, c in conditions.items():
        o = c["observations"]
        summary.append(dict(name=name, requestedDose=c["requested"], effectiveDose=c["effective"],
            injectedSpikeCounts=[x["inputSpikeCount"] for x in o], downstreamSpikeCounts=[x["downstreamSpikeCount"] for x in o],
            downstreamActiveCellCounts=[x["downstreamActiveCellCount"] for x in o],
            meanEndpointVoltage=[float(np.mean(x["endpointMeanVoltage"])) for x in o], motorMeans=[x["motorMean"] for x in o]))
    return dict(protocol=frozen["protocol"], slice=frozen["slice"], phase=frozen["phase"],
        diagnosticPassed=all(c["passed"] for c in contrasts) and all(g["passed"] for g in gates),
        completeSlicePassed=False, freezeHash=report["freezeHash"], seeds=seeds, degreesOfFreedom=len(seeds)-1,
        confidenceFamily=0.95, multipleComparisons=count, criticalT=critical, voltageResponseFloor=voltage_floor,
        populationCounts={key: len(value) for key, value in populations.items()}, contrasts=contrasts, gates=gates, descriptiveComparisons=descriptive, conditions=summary,
        scope="Offline fixed-input diagnostics. No complete browser transaction/record/body, navigation, physiological-color or preferred motor outcome claim.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("freeze", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    report_bytes = args.report.read_bytes()
    if args.report.suffix == ".gz":
        report_bytes = gzip.decompress(report_bytes)
    report = json.loads(report_bytes)
    require(report["frozen"]["pack"]["analysisSha256"] == hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "Analyzer differs from preregistered source")
    require(report["frozen"]["pack"]["statisticsOwnerSha256"] == hashlib.sha256((ROOT / "scripts/connectome/analyze_neural_vision.py").read_bytes()).hexdigest(), "Statistical owner differs from preregistered source")
    result = analyze(report, args.freeze.read_bytes())
    result["reportSha256"] = hashlib.sha256(report_bytes).hexdigest()
    result["analyzerSha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    result["statisticsOwnerSha256"] = hashlib.sha256((ROOT / "scripts/connectome/analyze_neural_vision.py").read_bytes()).hexdigest()
    with args.output.open("x") as stream:
        stream.write(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(json.dumps({key: result[key] for key in ["slice", "diagnosticPassed", "populationCounts", "multipleComparisons"]}))
    raise SystemExit(0 if result["diagnosticPassed"] else 1)
