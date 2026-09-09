"""Losslessly package frozen offline reports; never reruns or reinterprets neural gates."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def package(directory):
    entries = []
    decoded = {}
    for name in ["report.json", "analysis.json"]:
        original = directory / name
        archive = directory / (name + ".gz")
        raw = original.read_bytes() if original.exists() else gzip.decompress(archive.read_bytes())
        encoded = gzip.compress(raw, compresslevel=9, mtime=0)
        assert gzip.decompress(encoded) == raw
        archive.write_bytes(encoded)
        assert digest(gzip.decompress(archive.read_bytes())) == digest(raw)
        entries.append(dict(path=archive.name, encoding="gzip", decodedFilename=name,
            decodedBytes=len(raw), decodedSha256=digest(raw), storedBytes=len(encoded), storedSha256=digest(encoded)))
        decoded[name] = json.loads(raw)
        if original.exists():
            original.unlink()
    figures = directory / "figures/figures.json"
    if figures.exists():
        metadata = json.loads(figures.read_bytes())
        metadata["report"] = "report.json.gz"
        metadata["analysis"] = "analysis.json.gz"
        figures.write_text(json.dumps(metadata, indent=2) + "\n")
    report, analysis = decoded["report.json"], decoded["analysis.json"]
    assert digest((directory / "freeze.json").read_bytes()) == report["freezeHash"]
    assert entries[0]["decodedSha256"] == analysis["reportSha256"]
    frozen = report["frozen"]
    conditions = {c["name"]: c for c in report["conditions"]}
    summary = []
    for contrast in analysis["contrasts"]:
        a, b = conditions[contrast["a"]], conditions[contrast["b"]]
        differences = [x-y for x,y in zip(a["effectiveCurrentByEntry"], b["effectiveCurrentByEntry"])]
        changed_inputs = sum(value != 0 for value in differences)
        endpoint_spike_cells = contrast["endpointCountWithAnySpikeDifference"]
        summary.append(dict(a=contrast["a"], b=contrast["b"], voltageGate=contrast["membraneVoltagePassed"],
            spikeGate=contrast["spikeCountPassed"], correctedVoltageCells=contrast["correctedEndpointCount"],
            correctedSpikeCells=contrast["correctedSpikingEndpointCount"], changedInjectedCells=changed_inputs,
            currentDifferenceL1=sum(abs(v) for v in differences), currentDifferenceMaximum=max(abs(v) for v in differences),
            totalDoseA=a["effective"]["total"], totalDoseB=b["effective"]["total"],
            endpointsWithAnySpikeCountDifference=endpoint_spike_cells,
            allDownstreamCellsWithDifferentAggregatedCounts=contrast["downstreamCellCountWithDifferentAggregatedSpikes"],
            perSeedDownstreamSpikeCountDifferences=contrast["downstreamSpikeDifferences"]))
    result = dict(slice=frozen["slice"], phase=frozen["phase"], panelPassed=analysis["diagnosticPassed"],
        completeSlicePassed=False, gatesAllPassed=all(g["passed"] for g in analysis["gates"]),
        populationCounts=analysis["populationCounts"], contrasts=summary,
        elapsedSeconds=report["elapsedSeconds"], archive=entries,
        scope="Counts/voltage propagation and corrected gates are separate. Compression preserves every original report byte; no production record codec is introduced.")
    (directory / "evidence.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(dict(directory=str(directory), decodedBytes=sum(e["decodedBytes"] for e in entries),
        storedBytes=sum(e["storedBytes"] for e in entries), panelPassed=result["panelPassed"])))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    package(parser.parse_args().directory)
