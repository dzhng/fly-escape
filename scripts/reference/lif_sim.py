"""
Eon-style Leaky Integrate-and-Fire (LIF) simulation on MaleCNS connectome.

The LIF model:
- Membrane potential V_i evolves with leak and synaptic input
- dV_i/dt = -V_i/tau + sum_j(W_ij * spike_j) + I_ext
- Spike when V_i > threshold, then reset to 0

Motor output:
- DN (descending) and MN (motor) neurons drive locomotion
- L/R asymmetry maps to thrust/turn unicycle control

CRITICAL: Motor turn must emerge from graph dynamics, not external bias.
"""

import numpy as np
from scipy import sparse
from typing import Dict, Set, Optional, Tuple, List, Callable
from dataclasses import dataclass
import pandas as pd


@dataclass
class LIFParams:
    """LIF simulation parameters."""
    tau: float = 20.0           # Membrane time constant
    threshold: float = 1.0      # Spike threshold
    reset: float = 0.0          # Post-spike reset
    dt: float = 1.0             # Time step
    refractory: int = 2         # Refractory period
    noise_std: float = 0.015    # Moderate noise
    input_scale: float = 0.0002 # Moderate input scale
    baseline_drive: float = 0.05  # Baseline drive


# DNs that receive input from excitatory LH neurons (for olfactory-driven turning)
OLFACTORY_DN_LEFT = [
    10118, 556286, 10249, 10800, 10713, 522961, 11961, 10286, 11704,
    13586, 12299, 11261, 10425, 522345, 10469, 11944, 518177,
    12874, 11573, 10674, 10752, 11201, 11204, 11223, 11420
]

OLFACTORY_DN_RIGHT = [
    524968, 10065, 506334, 12843, 13366, 12210, 11365, 20418, 10264,
    11513, 11765, 10464, 12212, 13500, 11103, 10924, 10822, 10989,
    11302, 11334, 11505, 10056, 10063, 10195, 10237
]

# Flight-related DNs (from Drosophila literature)
# These control wing power and steering in flight
FLIGHT_DN_LEFT = [
    10442,   # DNa01 L - steering
    523769,  # DNa02 L - steering
    11074,   # DNg13 L - wing power
    524225,  # DNg14 L - wing power
    10783,   # DNp09 L - flight power
    10654,   # DNb01 L - flight init
    12767,   # DNb02 L - flight power
    529488,  # DNb02 L
    10752,   # DNp03 L - flight
]

FLIGHT_DN_RIGHT = [
    10760,   # DNa01 R - steering
    10360,   # DNa02 R - steering
    512006,  # DNg13 R - wing power
    12224,   # DNg14 R - wing power
    11177,   # DNp09 R - flight power
    10759,   # DNb01 R - flight init
    10805,   # DNb02 R - flight power
    13922,   # DNb02 R
    10989,   # DNp03 R - flight
]


class LIFSimulator:
    """Leaky Integrate-and-Fire simulator for MaleCNS."""
    
    def __init__(
        self,
        adjacency: sparse.csr_matrix,
        body_to_idx: Dict[int, int],
        idx_to_body: Dict[int, int],
        params: Optional[LIFParams] = None,
        seed: int = 42,
    ):
        self.adj = adjacency
        self.body_to_idx = body_to_idx
        self.idx_to_body = idx_to_body
        self.n = adjacency.shape[0]
        self.params = params or LIFParams()
        self.rng = np.random.default_rng(seed)
        
        self.V = np.zeros(self.n)
        self.spikes = np.zeros(self.n, dtype=bool)
        self.refractory_counter = np.zeros(self.n, dtype=int)
        
        # All motor neurons
        self.dn_left_idx: List[int] = []
        self.dn_right_idx: List[int] = []
        self.mn_left_idx: List[int] = []
        self.mn_right_idx: List[int] = []
        
        # Olfactory-specific DNs (receive excitatory LH input)
        self.olf_dn_left_idx: List[int] = []
        self.olf_dn_right_idx: List[int] = []
        
        # Flight-specific DNs (wing power and steering)
        self.flight_dn_left_idx: List[int] = []
        self.flight_dn_right_idx: List[int] = []
        
        self.external_current = np.zeros(self.n)
        
    def set_motor_neurons(
        self,
        dn_bodies: Set[int],
        mn_bodies: Set[int],
        graph: "MaleCNSGraph",
    ):
        """Identify L/R motor neurons for thrust/turn computation."""
        for body_id in dn_bodies:
            if body_id in self.body_to_idx:
                idx = self.body_to_idx[body_id]
                side = graph.get_body_side(body_id)
                if side == "L":
                    self.dn_left_idx.append(idx)
                elif side == "R":
                    self.dn_right_idx.append(idx)
                else:
                    self.dn_left_idx.append(idx)
                    self.dn_right_idx.append(idx)
        
        for body_id in mn_bodies:
            if body_id in self.body_to_idx:
                idx = self.body_to_idx[body_id]
                side = graph.get_body_side(body_id)
                if side == "L":
                    self.mn_left_idx.append(idx)
                elif side == "R":
                    self.mn_right_idx.append(idx)
                else:
                    self.mn_left_idx.append(idx)
                    self.mn_right_idx.append(idx)
        
        # Index olfactory-specific DNs
        for body_id in OLFACTORY_DN_LEFT:
            if body_id in self.body_to_idx:
                self.olf_dn_left_idx.append(self.body_to_idx[body_id])
        for body_id in OLFACTORY_DN_RIGHT:
            if body_id in self.body_to_idx:
                self.olf_dn_right_idx.append(self.body_to_idx[body_id])
        
        # Index flight-specific DNs
        for body_id in FLIGHT_DN_LEFT:
            if body_id in self.body_to_idx:
                self.flight_dn_left_idx.append(self.body_to_idx[body_id])
        for body_id in FLIGHT_DN_RIGHT:
            if body_id in self.body_to_idx:
                self.flight_dn_right_idx.append(self.body_to_idx[body_id])
        
        print(f"  Motor neurons indexed: DN L={len(self.dn_left_idx)}, R={len(self.dn_right_idx)}")
        print(f"                         MN L={len(self.mn_left_idx)}, R={len(self.mn_right_idx)}")
        print(f"  Olfactory DNs indexed: L={len(self.olf_dn_left_idx)}, R={len(self.olf_dn_right_idx)}")
        print(f"  Flight DNs indexed: L={len(self.flight_dn_left_idx)}, R={len(self.flight_dn_right_idx)}")
    
    def set_external_current(self, currents: Dict[int, float]):
        """Set external current injection by body ID."""
        self.external_current.fill(0)
        for body_id, current in currents.items():
            if body_id in self.body_to_idx:
                idx = self.body_to_idx[body_id]
                self.external_current[idx] = current
    
    def step(self) -> Tuple[np.ndarray, float, float]:
        """
        Run one timestep of LIF simulation.
        
        Returns:
            spikes: Boolean array of which neurons spiked
            thrust: Forward thrust command
            turn: Turn command (positive = right)
        """
        p = self.params
        
        synaptic_input = self.adj.T @ self.spikes.astype(float)
        synaptic_input *= p.input_scale
        
        noise = self.rng.normal(0, p.noise_std, self.n)
        baseline = p.baseline_drive
        
        dV = (-self.V / p.tau + synaptic_input + self.external_current + noise + baseline) * p.dt
        
        can_spike = self.refractory_counter == 0
        self.V += dV * can_spike
        
        self.spikes = (self.V > p.threshold) & can_spike
        self.V[self.spikes] = p.reset
        self.refractory_counter[self.spikes] = p.refractory
        
        self.refractory_counter = np.maximum(0, self.refractory_counter - 1)
        
        self.V = np.clip(self.V, -2.0, 2.0)
        
        thrust, turn = self._compute_motor_output()
        
        return self.spikes.copy(), thrust, turn
    
    def _compute_motor_output(self) -> Tuple[float, float]:
        """
        Compute thrust/turn from DN/MN L/R asymmetry.
        
        THRUST: Average of all DN/MN (general locomotion drive)
        TURN: From olfactory-specific DNs only (chemotaxis)
              These are the DNs that receive excitatory LH input.
        """
        if not self.dn_left_idx and not self.mn_left_idx:
            return 0.0, 0.0
        
        # Thrust from all motor neurons
        dn_l = np.mean(self.V[self.dn_left_idx]) if self.dn_left_idx else 0
        dn_r = np.mean(self.V[self.dn_right_idx]) if self.dn_right_idx else 0
        mn_l = np.mean(self.V[self.mn_left_idx]) if self.mn_left_idx else 0
        mn_r = np.mean(self.V[self.mn_right_idx]) if self.mn_right_idx else 0
        
        thrust = (dn_l + dn_r + mn_l + mn_r) / 4.0
        
        # Turn from olfactory-specific DNs
        # These are the DNs that receive input from excitatory LH neurons
        if self.olf_dn_left_idx and self.olf_dn_right_idx:
            olf_dn_l = np.mean(self.V[self.olf_dn_left_idx])
            olf_dn_r = np.mean(self.V[self.olf_dn_right_idx])
            turn = (olf_dn_r - olf_dn_l)  # R > L → turn right
        else:
            # Fallback to all DNs if olfactory DNs not available
            turn = ((dn_r + mn_r) - (dn_l + mn_l)) / 4.0
        
        return float(thrust), float(turn)
    
    def compute_flight_motor_output(self) -> Tuple[float, float]:
        """
        Compute flight motor output using flight-specific + olfactory DNs.
        
        THRUST: From flight DNs (wing power neurons)
        TURN: Combined from flight steering DNs + olfactory DNs
        
        Flight DNs: DNa01/02 (steering), DNg13/14 (power), DNp09, DNb01/02
        """
        # Flight thrust from flight-specific DNs
        if self.flight_dn_left_idx and self.flight_dn_right_idx:
            flight_l = np.mean(self.V[self.flight_dn_left_idx])
            flight_r = np.mean(self.V[self.flight_dn_right_idx])
            flight_thrust = (flight_l + flight_r) / 2.0
            flight_turn = (flight_r - flight_l)  # R > L → turn right
        else:
            flight_thrust = 0.0
            flight_turn = 0.0
        
        # Olfactory turn contribution
        if self.olf_dn_left_idx and self.olf_dn_right_idx:
            olf_dn_l = np.mean(self.V[self.olf_dn_left_idx])
            olf_dn_r = np.mean(self.V[self.olf_dn_right_idx])
            olf_turn = (olf_dn_r - olf_dn_l)
        else:
            olf_turn = 0.0
        
        # Also include general DN activity for baseline thrust
        dn_l = np.mean(self.V[self.dn_left_idx]) if self.dn_left_idx else 0
        dn_r = np.mean(self.V[self.dn_right_idx]) if self.dn_right_idx else 0
        general_thrust = (dn_l + dn_r) / 2.0
        
        # Combined output
        # Flight thrust is weighted higher for more dynamic flight
        thrust = flight_thrust * 1.5 + general_thrust * 0.5
        
        # Combined turn from flight steering + olfactory
        turn = flight_turn * 0.5 + olf_turn * 1.0
        
        return float(thrust), float(turn)
    
    def reset(self, seed: Optional[int] = None):
        """Reset simulation state."""
        if seed is not None:
            self.rng = np.random.default_rng(seed)
        self.V = np.zeros(self.n)
        self.spikes = np.zeros(self.n, dtype=bool)
        self.refractory_counter = np.zeros(self.n, dtype=int)
        self.external_current = np.zeros(self.n)
    
    def run(
        self,
        n_steps: int,
        external_currents_fn: Optional[Callable[[int], Dict[int, float]]] = None,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Run simulation for n_steps.
        """
        thrusts = np.zeros(n_steps)
        turns = np.zeros(n_steps)
        spike_counts = np.zeros(n_steps)
        
        for t in range(n_steps):
            if external_currents_fn:
                currents = external_currents_fn(t)
                self.set_external_current(currents)
            
            spikes, thrust, turn = self.step()
            thrusts[t] = thrust
            turns[t] = turn
            spike_counts[t] = spikes.sum()
        
        return thrusts, turns, spike_counts
