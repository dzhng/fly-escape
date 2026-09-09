"""Confirmation gates use synthetic responses, never held-out neural runs."""
import copy
import hashlib
import json
import sys
import subprocess
import tempfile
import unittest
from pathlib import Path

import numpy as np
from scipy.stats import t

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from connectome.analyze_neural_vision import analyze as analyze_report


def analyze(report):
    freeze = json.dumps(report["frozenNeural"]).encode()
    report["freezeHash"] = hashlib.sha256(freeze).hexdigest()
    return analyze_report(report, freeze)


def fixture():
    def condition(name, level, silence="none"):
        digest = hashlib.sha256(str(level).encode()).hexdigest()
        return dict(name=name, silence=silence, totalCurrent=level,
                    sample=dict(vision=dict(brightness=[level] * 8, blocked=[0.] * 8)),
                    observations=[dict(seed=s, relayVoltage=[level, 0.], relaySpikes=[0., 0.],
                                       neuralTrajectoryHash=digest) for s in range(100, 130)])
    conditions = [condition("dark", 0.), condition("uniform", 1.)]
    conditions += [condition(f"basis-{b}", b + 1.) for b in range(8)]
    for side, factor in [("left", 1.), ("right", 2.)]:
        for rate in [0.5, 1, 2]:
            conditions.append(condition(f"lamp-{side}-{rate}", rate * factor))
    for name in ["wall", "furniture"]:
        c = condition(name, 0.)
        c["sample"]["vision"]["blocked"] = [2.] * 8
        conditions.append(c)
    conditions.append(condition("opening", 2.))
    for name in ["dark", "lamp-left", "lamp-right"]:
        conditions.append(condition(name + "-inputs", 0., "inputs"))
    for name in [*(f"basis-{b}" for b in range(8)),
                 *(f"lamp-{s}-{r}" for s in ["left", "right"] for r in [0.5, 2])]:
        conditions.append(condition(name + "-inputs", 0., "inputs"))
    for name, level in [("dark", 0.), ("lamp-left", 1.), ("lamp-right", 2.)]:
        conditions.append(condition(name + "-sham", level, "sham"))
    frozen = dict(protocol="overlapping-Tm2-neural-confirmation-v1", family="Tm2", gain=3,
                  inputs=[1], relays=[2, 3], sham=[4], inputBodyIds=["i"],
                  relayBodyIds=["r", "s"], shamBodyIds=["z"])
    identities = {k: "a" * 64 for k in ["graphHash", "annotationHash", "auditHash", "manifestHash",
                  "probeSourceHash", "sensorySourceHash", "lifSourceHash", "graphSourceHash", "fieldsSourceHash", "geometrySourceHash", "mappingHash"]}
    frozen.update(identities)
    return dict(protocol=frozen["protocol"], family="Tm2", gain=3, mode="neural-confirm", **identities,
                inputs=[1], relays=[2, 3], sham=[4], frozenNeural=frozen,
                warmupTicks=60, measuredTicks=100, conditions=conditions)


class AnalysisTests(unittest.TestCase):
    def test_constant_effects_pass_but_constant_zero_cells_do_not(self):
        result = analyze(fixture())
        self.assertTrue(result["passed"])
        self.assertEqual(result["multipleComparisons"], 14)
        first = result["contrasts"][0]["cells"]
        self.assertEqual(first[0]["interval"], [-4., -4.])
        self.assertTrue(first[0]["zeroVariance"])
        self.assertFalse(first[1]["significant"])

    def test_correction_rejects_a_nominally_significant_coordinate(self):
        report = fixture()
        values = np.arange(30, dtype=float)
        values -= np.mean(values)
        se = np.std(values, ddof=1) / np.sqrt(30)
        values += 2.7 * se
        basis = next(c for c in report["conditions"] if c["name"] == "basis-0")
        for observation, delta in zip(basis["observations"], values):
            observation["relayVoltage"][0] = 5 + float(delta)
        result = analyze(report)
        cell = result["contrasts"][0]["cells"][0]
        self.assertGreater(cell["mean"] / cell["standardError"], t.isf(.025, 29))
        self.assertFalse(cell["significant"])
        self.assertFalse(result["contrasts"][0]["passed"])
        self.assertFalse(result["passed"])

    def test_every_optical_and_causal_failure_blocks_an_otherwise_passing_report(self):
        changes = [
            ("wall", lambda c: c["sample"]["vision"]["brightness"].__setitem__(0, .1), "optical:wall"),
            ("furniture", lambda c: c["sample"]["vision"].__setitem__("blocked", [0.] * 8), "optical:furniture"),
            ("opening", lambda c: c["observations"][7].__setitem__("neuralTrajectoryHash", "f" * 64), "trajectory:opening=lamp-right-1"),
            ("basis-7-inputs", lambda c: c["observations"][5].__setitem__("neuralTrajectoryHash", "f" * 64), "trajectory:basis-7-inputs=dark-inputs"),
            ("lamp-right-2-inputs", lambda c: c["observations"][0].__setitem__("neuralTrajectoryHash", "f" * 64), "trajectory:lamp-right-2-inputs=dark-inputs"),
            ("lamp-left-sham", lambda c: c["observations"][9]["relaySpikes"].__setitem__(1, .01), "sham:left"),
            ("lamp-right-2", lambda c: c.__setitem__("totalCurrent", 2.), "graded-current:right"),
        ]
        for name, mutate, gate in changes:
            with self.subTest(name=name):
                report = fixture()
                mutate(next(c for c in report["conditions"] if c["name"] == name))
                result = analyze(report)
                self.assertFalse(result["passed"])
                self.assertFalse(next(g for g in result["gates"] if g["name"] == gate)["passed"])

    def test_missing_duplicate_unpaired_or_nonfinite_data_is_rejected(self):
        for change, message in [
            (lambda r: r["conditions"].pop(), "conditions"),
            (lambda r: r["conditions"].append(copy.deepcopy(r["conditions"][0])), "conditions"),
            (lambda r: r["conditions"][0]["observations"][0].__setitem__("seed", 101), "seed order"),
            (lambda r: r["conditions"][0]["observations"][0]["relayVoltage"].__setitem__(0, float("nan")), "Nonfinite"),
            (lambda r: r["frozenNeural"].__setitem__("relays", [2]), "frozen relays"),
        ]:
            with self.subTest(message=message):
                report = fixture()
                change(report)
                with self.assertRaisesRegex(ValueError, message):
                    analyze(report)

    def test_external_freeze_and_report_identities_must_agree(self):
        report = fixture()
        freeze = json.dumps(report["frozenNeural"]).encode()
        report["freezeHash"] = hashlib.sha256(freeze).hexdigest()
        with self.assertRaisesRegex(ValueError, "Freeze file identity"):
            analyze_report(report, freeze + b" ")
        report["mappingHash"] = "b" * 64
        with self.assertRaisesRegex(ValueError, "mappingHash"):
            analyze_report(report, freeze)

    def test_every_contrast_must_pass_even_when_other_contrasts_are_strong(self):
        report = fixture()
        basis = next(c for c in report["conditions"] if c["name"] == "basis-3")
        for observation in basis["observations"]:
            observation["relayVoltage"] = [8., 0.]
        result = analyze(report)
        self.assertEqual([c["passed"] for c in result["contrasts"]],
                         [True, True, True, False, True, True, True])
        self.assertFalse(result["passed"])

    def test_cli_preserves_failed_results_and_returns_failure(self):
        report = fixture()
        report["conditions"][0]["sample"]["vision"]["brightness"][0] = .1
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory) / "report.json", Path(directory) / "analysis.json"
            freeze = Path(directory) / "freeze.json"
            freeze.write_text(json.dumps(report["frozenNeural"]))
            report["freezeHash"] = hashlib.sha256(freeze.read_bytes()).hexdigest()
            source.write_text(json.dumps(report))
            script = Path(__file__).resolve().parents[2] / "scripts/connectome/analyze_neural_vision.py"
            process = subprocess.run([sys.executable, str(script), str(source), str(freeze), str(output)],
                                     capture_output=True, text=True)
            self.assertEqual(process.returncode, 1, process.stderr)
            result = json.loads(output.read_text())
            self.assertFalse(result["passed"])
            self.assertEqual(result["sourceReportHash"], hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertEqual(len(result["contrasts"]), 7)
            prior = output.read_bytes()
            process = subprocess.run([sys.executable, str(script), str(source), str(freeze), str(output)],
                                     capture_output=True, text=True)
            self.assertNotEqual(process.returncode, 0)
            self.assertEqual(output.read_bytes(), prior)


if __name__ == "__main__":
    unittest.main()
