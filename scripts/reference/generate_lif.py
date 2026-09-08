"""Generate synthetic porting evidence by executing the actual Python LIF oracle."""

import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from scipy import sparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.reference.lif_sim import LIFParams, LIFSimulator


class InjectedNoise:
    """Supply already-scaled normal samples; fixture inputs replace only the RNG."""

    def __init__(self, samples):
        self.samples = iter(samples)

    def normal(self, loc, scale, size):
        sample = np.asarray(next(self.samples), dtype=np.float64)
        if sample.shape != (size,):
            raise ValueError("Noise sample must contain one value per neuron")
        return sample.copy()


def run_case(case):
    n = len(case["initial"]["voltage"])
    edges = case["edges"]
    adjacency = sparse.csr_matrix(
        ([edge[2] for edge in edges],
         ([edge[0] for edge in edges], [edge[1] for edge in edges])),
        shape=(n, n), dtype=np.float64,
    )
    body_to_idx = {int(body): idx for idx, body in enumerate(case["body_ids"])}
    sim = LIFSimulator(adjacency, body_to_idx,
                       {idx: body for body, idx in body_to_idx.items()},
                       LIFParams(**case["params"]))
    sim.V = np.array(case["initial"]["voltage"], dtype=np.float64)
    sim.spikes = np.array(case["initial"]["spikes"], dtype=bool)
    sim.refractory_counter = np.array(case["initial"]["refractory"], dtype=int)
    for group, indices in case["motor_groups"].items():
        setattr(sim, group + "_idx", indices.copy())
    sim.rng = InjectedNoise(tick["noise"] for tick in case["ticks"])
    observations = []
    for tick in case["ticks"]:
        sim.set_external_current({int(body): value for body, value in tick["external_by_body"].items()})
        intermediate = {}

        def capture(frame, event, arg):
            # Read the oracle's actual intermediates without maintaining another LIF.
            if frame.f_code is LIFSimulator.step.__code__ and event == "return":
                for name in ("synaptic_input", "dV", "can_spike"):
                    intermediate[name] = frame.f_locals[name].tolist()

        previous_profile = sys.getprofile()
        sys.setprofile(capture)
        try:
            spikes, thrust, turn = sim.step()
        finally:
            sys.setprofile(previous_profile)
        flight_thrust, flight_turn = sim.compute_flight_motor_output()
        observations.append({
            **intermediate,
            "external_current": sim.external_current.tolist(),
            "voltage": sim.V.tolist(), "spikes": spikes.tolist(),
            "refractory": sim.refractory_counter.tolist(),
            "thrust": thrust, "turn": turn,
            "flight_thrust": flight_thrust, "flight_turn": flight_turn,
        })
    return observations


def cases():
    params = asdict(LIFParams(tau=4, threshold=1, reset=0.125, dt=0.5,
                             refractory=3, noise_std=0.1, input_scale=0.25,
                             baseline_drive=0.125))
    groups = {"dn_left": [0, 2], "dn_right": [1], "mn_left": [2],
              "mn_right": [3], "olf_dn_left": [0], "olf_dn_right": [1],
              "flight_dn_left": [2], "flight_dn_right": [3]}
    yield {
        "name": "asymmetric_signed_delayed_input",
        "body_ids": ["10", "20", "30", "40"], "params": params,
        "edges": [[0, 1, 2.0], [1, 0, -3.0], [0, 2, -1.0], [2, 3, 4.0]],
        "initial": {"voltage": [0.5, 0.25, -0.5, 0.75],
                    "spikes": [True, False, False, False], "refractory": [0, 0, 0, 0]},
        "motor_groups": groups,
        "ticks": [
            {"noise": [0.125, -0.25, 0.0, 0.25], "external_by_body": {"20": 2.0, "999": 500.0}},
            {"noise": [-0.125, 0.25, -0.25, 0.0], "external_by_body": {"30": 8.0}},
            {"noise": [0.0, 0.0, 0.0, 0.0], "external_by_body": {}},
            {"noise": [0.25, -0.125, 0.125, -0.25], "external_by_body": {}},
        ],
    }
    yield {
        "name": "strict_threshold_refractory_and_clamp",
        "body_ids": ["10", "20", "30", "40"],
        "params": asdict(LIFParams(tau=2, threshold=1, reset=0.125, dt=1,
                                   refractory=2, noise_std=0.1, input_scale=1,
                                   baseline_drive=0)),
        "edges": [],
        "initial": {"voltage": [0, 0, 3, -1], "spikes": [False] * 4,
                    "refractory": [0, 0, 1, 0]},
        "motor_groups": {**groups, "olf_dn_left": [], "olf_dn_right": []},
        "ticks": [
            {"noise": [0, 0, 0, 0], "external_by_body": {"10": 1.0, "20": 1.125, "40": -8.0}},
            {"noise": [0, 0, 0, 0], "external_by_body": {"20": 8.0}},
            {"noise": [0, 0, 0, 0], "external_by_body": {"20": 1.0}},
        ],
    }
    yield {
        # A spiking neuron resets to its floor, so the group that just fired reads
        # lowest in voltage. Every tick here separates the two possible readouts:
        # the firing difference and the voltage difference disagree in sign or in
        # which of them is zero, so a voltage-based turn cannot reproduce this case.
        "name": "olfactory_turn_follows_firing_not_reset_voltage",
        "body_ids": ["10", "20", "30", "40"],
        "params": asdict(LIFParams(tau=100, threshold=1, reset=0.125, dt=1,
                                   refractory=2, noise_std=0.1, input_scale=1,
                                   baseline_drive=0)),
        "edges": [],
        "initial": {"voltage": [0.9, 0.9, -0.5, 0.25], "spikes": [False] * 4,
                    "refractory": [0, 0, 0, 0]},
        "motor_groups": groups,
        "ticks": [
            # Right fires and resets below the silent left group: firing says turn
            # right, the voltages say the opposite.
            {"noise": [0, 0, 0, 0], "external_by_body": {"20": 0.5}},
            # Left fires while the right group sits at the same reset floor:
            # firing says turn left, the voltages are equal and say nothing.
            {"noise": [0, 0, 0, 0], "external_by_body": {"10": 0.5}},
            # Neither fires though their voltages still differ: no olfactory turn.
            {"noise": [0, 0, 0, 0], "external_by_body": {}},
        ],
    }


def generate():
    return {
        "synthetic": True,
        "purpose": "Tiny numerical porting oracle; not a biological graph or real-data acceptance",
        "oracle": {"path": "scripts/reference/lif_sim.py",
                   "sha256": hashlib.sha256((ROOT / "scripts/reference/lif_sim.py").read_bytes()).hexdigest()},
        "edge_columns": ["presynaptic_index", "postsynaptic_index", "weight"],
        "noise_semantics": "Already-scaled additive samples returned by rng.normal, not z-scores",
        "float_comparison": {"absolute_tolerance": 1e-12, "relative_tolerance": 1e-12},
        "cases": [{**case, "expected": run_case(case)} for case in cases()],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "tests/reference/lif_synthetic.json")
    args = parser.parse_args()
    args.output.write_text(json.dumps(generate(), indent=2, allow_nan=False) + "\n")
