"""Behavior guards for the Python oracle and its portable synthetic evidence."""

from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.reference.generate_lif import cases, run_case


class LIFReferenceTests(unittest.TestCase):
    def test_fixture_is_reproducible_from_actual_oracle(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "fixture.json"
            subprocess.run([sys.executable, str(ROOT / "scripts/reference/generate_lif.py"),
                            "--output", str(output)], check=True)
            self.assertEqual(output.read_bytes(),
                             (ROOT / "tests/reference/lif_synthetic.json").read_bytes())

    def test_signed_edges_use_previous_spikes_in_source_to_destination_direction(self):
        first, second, third, _ = run_case(next(cases()))
        self.assertEqual(first["synaptic_input"], [0.0, 0.5, -0.25, 0.0])
        self.assertEqual(first["spikes"], [False, True, False, False])
        self.assertEqual(second["synaptic_input"], [-0.75, 0.0, 0.0, 0.0])
        self.assertEqual(second["spikes"], [False, False, True, False])
        self.assertEqual(third["synaptic_input"], [0.0, 0.0, 0.0, 1.0])

    def test_threshold_is_strict_and_refractory_decrements_after_spiking(self):
        case = list(cases())[1]
        first, second, third = run_case(case)
        self.assertEqual(first["spikes"], [False, True, False, False])
        self.assertEqual(first["voltage"], [1.0, 0.125, 2.0, -2.0])
        self.assertEqual(first["refractory"], [0, 1, 0, 0])
        self.assertEqual(second["can_spike"], [True, False, True, True])
        self.assertEqual(second["voltage"][1], 0.125)
        self.assertEqual(second["refractory"][1], 0)
        self.assertTrue(third["spikes"][1])

    def test_external_current_replaces_previous_tick_and_ignores_unknown_bodies(self):
        first, second, third, _ = run_case(next(cases()))
        self.assertEqual(first["external_current"], [0.0, 2.0, 0.0, 0.0])
        self.assertEqual(second["external_current"], [0.0, 0.0, 8.0, 0.0])
        self.assertEqual(third["external_current"], [0.0, 0.0, 0.0, 0.0])

    def test_motor_readouts_use_post_reset_voltage_and_overlapping_group_means(self):
        first = run_case(next(cases()))[0]
        self.assertEqual(first["dV"], [0.0625, 1.15625, 0.0, 0.09375])
        self.assertEqual(first["voltage"], [0.5625, 0.125, -0.5, 0.84375])
        self.assertEqual(first["thrust"], 0.125)
        self.assertEqual(first["turn"], -0.4375)
        self.assertEqual(first["flight_thrust"], 0.296875)
        self.assertEqual(first["flight_turn"], 0.234375)
        fallback = run_case(list(cases())[1])[0]
        self.assertEqual(fallback["thrust"], 0.40625)
        self.assertEqual(fallback["turn"], -1.34375)


if __name__ == "__main__":
    unittest.main()
