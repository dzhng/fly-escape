"""Analyze the preregistered neural-only confirmation; never runs a simulation."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy.stats import t


PROTOCOL = "overlapping-Tm2-neural-confirmation-v1"
SEEDS = list(range(100, 130))
CONTRASTS = [
    *((f"basis-{b}", f"basis-{b + 4}") for b in range(4)),
    ("lamp-left-1", "lamp-right-1"),
    ("lamp-left-2", "lamp-left-0.5"),
    ("lamp-right-2", "lamp-right-0.5"),
]
SILENCED = [
    "dark-inputs", "lamp-left-inputs", "lamp-right-inputs",
    *(f"basis-{b}-inputs" for b in range(8)),
    *(f"lamp-{side}-{rate}-inputs" for side in ["left", "right"] for rate in ["0.5", "2"]),
]


def require(predicate, message):
    if not predicate:
        raise ValueError(message)


def finite_vector(values, length, label):
    require(isinstance(values, list) and len(values) == length, f"Invalid {label} length")
    require(all(type(v) in (int, float) and math.isfinite(v) for v in values),
            f"Nonfinite or invalid {label}")


def validate(report, freeze_bytes):
    frozen = report["frozenNeural"]
    require(hashlib.sha256(freeze_bytes).hexdigest() == report["freezeHash"] and
            json.loads(freeze_bytes) == frozen, "Freeze file identity mismatch")
    require(report["protocol"] == frozen["protocol"] == PROTOCOL, "Wrong confirmation protocol")
    require(report["family"] == frozen["family"] == "Tm2" and
            report["gain"] == frozen["gain"] == 3, "Wrong frozen family or gain")
    require(report["mode"] == "neural-confirm" and report["warmupTicks"] == 60 and
            report["measuredTicks"] == 100, "Wrong confirmation sampling window")
    for name in ["inputs", "relays", "sham"]:
        indices = report[name]
        require(indices == frozen[name] and indices and
                all(type(i) is int and i >= 0 for i in indices) and
                indices == sorted(set(indices)), f"Invalid frozen {name}")
    require(not (set(report["relays"]) & set(report["inputs"])), "Endpoint intersects inputs")
    require(len(report["sham"]) == len(report["inputs"]) and
            not set(report["sham"]) & (set(report["inputs"]) | set(report["relays"])),
            "Invalid sham population")
    # The native freeze validates identities against actual graph/annotation files.
    for key in ["graphHash", "annotationHash", "auditHash", "manifestHash", "probeSourceHash",
                "sensorySourceHash", "lifSourceHash", "graphSourceHash", "fieldsSourceHash", "geometrySourceHash", "mappingHash"]:
        require(frozen[key] == report[key] and isinstance(report[key], str) and
                len(report[key]) == 64 and all(x in "0123456789abcdef" for x in report[key]),
                f"Frozen identity mismatch: {key}")
    conditions = {c["name"]: c for c in report["conditions"]}
    expected = {"dark", "uniform", "wall", "furniture", "opening",
                "dark-sham", "lamp-left-sham", "lamp-right-sham", *SILENCED,
                *(f"basis-{b}" for b in range(8)),
                *(f"lamp-{s}-{r}" for s in ["left", "right"] for r in ["0.5", "1", "2"])}
    require(len(conditions) == len(report["conditions"]) and set(conditions) == expected,
            "Missing, duplicate or unexpected confirmation conditions")
    for name, c in conditions.items():
        silence = "inputs" if name in SILENCED else "sham" if name.endswith("-sham") else "none"
        require(c["silence"] == silence, f"Wrong silencing mode: {name}")
        require(type(c["totalCurrent"]) in (int, float) and
                math.isfinite(c["totalCurrent"]) and c["totalCurrent"] >= 0,
                f"Invalid total current: {name}")
        for field in ["brightness", "blocked"]:
            v = c["sample"]["vision"][field]
            finite_vector(v, 8, f"{name} {field}")
            require(all(x >= 0 for x in v), f"Negative vision value: {name}")
        observations = c["observations"]
        require([o["seed"] for o in observations] == SEEDS, f"Wrong paired seed order: {name}")
        for o in observations:
            for field in ["relayVoltage", "relaySpikes"]:
                finite_vector(o[field], len(report["relays"]), f"{name} {field}")
            digest = o["neuralTrajectoryHash"]
            require(isinstance(digest, str) and len(digest) == 64 and
                    all(x in "0123456789abcdef" for x in digest), f"Invalid trajectory hash: {name}")
    return conditions


def paired_cells(differences, indices, multiple_comparisons):
    """Paired, simultaneous voltage intervals shared by frozen neural protocols."""
    differences = np.asarray(differences, dtype=float)
    require(differences.ndim == 2 and differences.shape[1] == len(indices) and
            differences.shape[0] >= 2 and multiple_comparisons >= len(indices), "Invalid paired panel")
    count = differences.shape[0]
    critical = float(t.isf(0.05 / (2 * multiple_comparisons), count - 1))
    cells = []
    for j, index in enumerate(indices):
        values = differences[:, j]
        zero_variance = bool(np.all(values == values[0]))
        mean = float(values[0]) if zero_variance else float(np.mean(values))
        se = 0. if zero_variance else float(np.std(values, ddof=1) / math.sqrt(count))
        require(math.isfinite(mean) and math.isfinite(se), "Paired statistics overflow")
        interval = [mean - critical * se, mean + critical * se]
        require(all(math.isfinite(x) for x in interval), "Interval overflow")
        cells.append(dict(index=index, seedDifferences=values.tolist(), mean=mean,
                          standardError=se, zeroVariance=zero_variance, interval=interval,
                          significant=interval[0] > 0 or interval[1] < 0))
    return critical, cells


def analyze(report, freeze_bytes):
    conditions = validate(report, freeze_bytes)
    comparisons = 7 * len(report["relays"])
    critical = float(t.isf(0.05 / (2 * comparisons), 29))
    contrasts = []
    for a, b in CONTRASTS:
        differences = np.array([o["relayVoltage"] for o in conditions[a]["observations"]]) - np.array(
            [o["relayVoltage"] for o in conditions[b]["observations"]])
        critical, cells = paired_cells(differences, report["relays"], comparisons)
        contrasts.append(dict(a=a, b=b, passed=any(c["significant"] for c in cells), cells=cells))

    gates = []

    def gate(name, passed, **evidence):
        gates.append(dict(name=name, passed=bool(passed), **evidence))

    def hashes(a, b):
        pairs = zip(conditions[a]["observations"], conditions[b]["observations"])
        seeds = [dict(seed=x["seed"], equal=x["neuralTrajectoryHash"] == y["neuralTrajectoryHash"])
                 for x, y in pairs]
        gate(f"trajectory:{a}={b}", all(s["equal"] for s in seeds), seeds=seeds)

    dark = conditions["dark"]["sample"]["vision"]
    visible = conditions["lamp-right-1"]["sample"]["vision"]
    gate("zero-ambient-dark", all(v == 0 for v in dark["brightness"]))
    for blocker in ["wall", "furniture"]:
        vision = conditions[blocker]["sample"]["vision"]
        gate(f"optical:{blocker}", vision["brightness"] == dark["brightness"] and
             any(v > 0 for v in vision["blocked"]), brightness=vision["brightness"],
             blocked=vision["blocked"])
        hashes(blocker, "dark")
    opening = conditions["opening"]["sample"]["vision"]
    gate("optical:opening", opening["brightness"] == visible["brightness"],
         brightness=opening["brightness"], visibleBrightness=visible["brightness"])
    hashes("opening", "lamp-right-1")
    for side in ["left", "right"]:
        currents = [conditions[f"lamp-{side}-{r}"]["totalCurrent"] for r in ["0.5", "1", "2"]]
        gate(f"graded-current:{side}", currents[0] < currents[1] < currents[2], currents=currents)
    for name in SILENCED:
        hashes(name, "dark-inputs")
    for side in ["left", "right"]:
        original = conditions[f"lamp-{side}-1"]["observations"]
        sham = conditions[f"lamp-{side}-sham"]["observations"]
        seeds = [dict(seed=a["seed"], voltageEqual=a["relayVoltage"] == b["relayVoltage"],
                      spikesEqual=a["relaySpikes"] == b["relaySpikes"])
                 for a, b in zip(original, sham)]
        gate(f"sham:{side}", all(s["voltageEqual"] and s["spikesEqual"] for s in seeds), seeds=seeds)
    return dict(protocol=PROTOCOL, passed=all(c["passed"] for c in contrasts) and
                all(g["passed"] for g in gates), frozenNeural=report["frozenNeural"],
                seeds=SEEDS, multipleComparisons=comparisons, criticalT=critical,
                confidenceFamily=0.95, degreesOfFreedom=29, contrasts=contrasts, gates=gates,
                freezeHash=report["freezeHash"],
                scope="Neural-only confirmation. All motor pilots remain failed; no behavioral or objective-4 gate is evaluated.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("freeze", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = args.report.read_bytes()
    result = analyze(json.loads(source), args.freeze.read_bytes())
    result["sourceReportHash"] = hashlib.sha256(source).hexdigest()
    result["analyzerHash"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    # Confirmation evidence must not silently replace an earlier analysis or input.
    with args.output.open("x") as output:
        output.write(json.dumps(result, indent=2, allow_nan=False) + "\n")
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
