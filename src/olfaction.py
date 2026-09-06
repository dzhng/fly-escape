"""
Bilateral olfactory injection for MaleCNS simulation.

CRITICAL: Chemotaxis must emerge from the graph, NOT from external turn bias.

KEY INSIGHT: LH neurons have different polarities:
- LHAD1g1 (strongest inhibitory) is GABAergic → INHIBITS DNs → causes AVERSION
- LHPV2i1, LHAD2c1, etc. are cholinergic → EXCITE DNs → cause ATTRACTION

ATTRACTIVE chemotaxis (toward fruit):
- Inject to EXCITATORY LH on side with more odor
- L-LHPV2i1 activated → L-DNs excited → turn LEFT toward odor

AVERSIVE chemotaxis (away from vinegar):
- Inject to INHIBITORY LH on side with more odor
- L-LHAD1g1 activated → L-DNs inhibited → R-DNs dominate → turn RIGHT away

Both pathways use PURE GRAPH dynamics — no external turn bias.
"""

from typing import Dict, Set, List, Tuple, Optional
import pandas as pd
import numpy as np


# Attractive glomerulus tuning (fruit esters)
GLOMERULUS_TUNING = {
    "DM1": {"ethyl_butyrate": 0.9, "hexyl_acetate": 0.7},
    "DM2": {"ethyl_acetate": 0.95, "ethyl_butyrate": 0.8, "isoamyl_acetate": 0.85},
    "DM3": {"isoamyl_acetate": 0.7},
    "DM4": {"ethyl_butyrate": 0.6},
    "DM5": {"ethyl_acetate": 0.8, "ethyl_butyrate": 0.7, "hexyl_acetate": 0.75},
    "DL1": {"methylbutyl_acetate": 0.8},
    "DL5": {"ethyl_acetate": 0.65},
    "DC2": {"isoamyl_acetate": 0.55},
    "VA6": {"methylbutyl_acetate": 0.7},
}

# Aversive glomerulus tuning (acids, amines)
# DC1, DC3, DC4: respond to acids (including acetic acid)
# DL3, DL4: respond to aversive compounds
# Based on Drosophila olfactory coding literature
AVERSIVE_GLOMERULUS_TUNING = {
    "DC1": {"acetic_acid": 0.85, "propionic_acid": 0.7},
    "DC3": {"acetic_acid": 0.75, "butyric_acid": 0.6},
    "DC4": {"acetic_acid": 0.65},
    "DL3": {"acetic_acid": 0.5, "propionic_acid": 0.6},
    "DL4": {"acetic_acid": 0.4, "ammonia": 0.8},
}

FRUIT_ESTER_BLEND = {
    "ethyl_acetate": 1.0,
    "ethyl_butyrate": 0.8,
    "isoamyl_acetate": 0.6,
    "hexyl_acetate": 0.4,
    "methylbutyl_acetate": 0.3,
}

# Vinegar odor blend (acetic acid dominant)
VINEGAR_BLEND = {
    "acetic_acid": 1.0,
    "propionic_acid": 0.3,
    "butyric_acid": 0.1,
}

# EXCITATORY LH→motor neurons (acetylcholine) - these drive ATTRACTION
# Sorted by total motor output weight
EXCITATORY_LH_MOTOR = {
    "L": [
        522730,  # LHPV2i1 L - 377 weight
        18007,   # LHPV2i1 L - 373 weight
        23637,   # LHAD2c1 L - 289 weight
        21362,   # LHPV2i2_a L - 242 weight
        11971,   # LHAV2p1 L - 210 weight
        11695,   # LHPV6j1 L - 163 weight
        25132,   # LHAD2c3 L - 163 weight
        535889,  # LHAD2c2 L - 144 weight
        22417,   # LHAV1a1 L - 99 weight
        39660,   # LHAD2c3 L - 123 weight
    ],
    "R": [
        517532,  # LHPV2i1 R - 308 weight
        20028,   # LHAD2c1 R - 252 weight
        13500,   # LHAV2p1 R - 224 weight
        16562,   # LHPV6j1 R - 197 weight
        21261,   # LHAD2c1 R - 197 weight
        20503,   # LHPV2i2_a R - 148 weight
        23194,   # LHAD2c3 R - 132 weight
        21772,   # LHAV1a1 R - 132 weight
        24030,   # LHAD2c3 R - 110 weight
        24394,   # LHAV1a1 R - 100 weight
    ],
}

# INHIBITORY LH→motor neurons (GABA/glutamate) - these drive AVERSION
# When activated, they INHIBIT downstream DNs on that side
# → opposite side dominates → fly turns AWAY from odor
# 
# LHAD1g1: STRONGEST inhibitory LH (GABAergic, ~1700 weight to DNs)
# LHPV10c1: Secondary (GABAergic, ~300 weight)
# LHAV8a1: Tertiary (Glutamatergic, ~250 weight)
# LHPV6g1: Quaternary (Glutamatergic, ~120 weight)
INHIBITORY_LH_MOTOR = {
    "L": [
        10147,   # LHAD1g1 L - 1651 weight (GABAergic) - STRONGEST
        13946,   # LHPV10c1 L - 293 weight (GABAergic)
        512859,  # LHAV8a1 L - 303 weight (Glutamatergic)
        13761,   # LHPV6g1 L - 139 weight (Glutamatergic)
        15598,   # LH004m L - 89 weight (GABAergic)
        11042,   # LHCENT10 L - 50 weight (GABAergic)
    ],
    "R": [
        10297,   # LHAD1g1 R - 1790 weight (GABAergic) - STRONGEST
        555875,  # LHPV10c1 R - 317 weight (GABAergic)
        20270,   # LHAV8a1 R - 204 weight (Glutamatergic)
        15039,   # LHPV6g1 R - 105 weight (Glutamatergic)
        19212,   # LH004m R - 46 weight (GABAergic)
        11682,   # LHCENT10 R - 60 weight (GABAergic)
    ],
}


def compute_glomerulus_response(odor_blend: Dict[str, float]) -> Dict[str, float]:
    """Compute glomerulus activation from an odor blend (attractive pathway)."""
    response = {}
    for glom, tuning in GLOMERULUS_TUNING.items():
        activation = 0.0
        for odorant, sensitivity in tuning.items():
            if odorant in odor_blend:
                activation += odor_blend[odorant] * sensitivity
        activation = min(1.0, activation)
        response[glom] = activation
    return response


def compute_aversive_glomerulus_response(odor_blend: Dict[str, float]) -> Dict[str, float]:
    """Compute glomerulus activation from an odor blend (aversive pathway)."""
    response = {}
    for glom, tuning in AVERSIVE_GLOMERULUS_TUNING.items():
        activation = 0.0
        for odorant, sensitivity in tuning.items():
            if odorant in odor_blend:
                activation += odor_blend[odorant] * sensitivity
        activation = min(1.0, activation)
        response[glom] = activation
    return response


class BilateralOlfactoryInjector:
    """
    Injects BILATERAL olfactory drive into MaleCNS neurons.
    
    ATTRACTIVE chemotaxis: EXCITATORY LH (cholinergic) → excite DNs → turn toward
    AVERSIVE chemotaxis: INHIBITORY LH (GABAergic) → inhibit DNs → turn away
    
    Both pathways are PURE GRAPH — no external turn bias.
    """
    
    ANTENNA_OFFSET = 20.0  # Larger offset for stronger bilateral signal
    
    def __init__(self, annotations: pd.DataFrame, body_to_idx: Dict[int, int]):
        self.annotations = annotations
        self.body_to_idx = body_to_idx
        
        # Excitatory LH→motor neurons (drive attraction)
        self.left_excitatory_lh: Set[int] = set()
        self.right_excitatory_lh: Set[int] = set()
        
        # Inhibitory LH→motor neurons (drive aversion)
        self.left_inhibitory_lh: Set[int] = set()
        self.right_inhibitory_lh: Set[int] = set()
        
        # Other olfactory neurons
        self.left_orns: Dict[str, Set[int]] = {}
        self.right_orns: Dict[str, Set[int]] = {}
        self.left_pns: Dict[str, Set[int]] = {}
        self.right_pns: Dict[str, Set[int]] = {}
        
        # Aversive ORNs (for acid/vinegar pathway)
        self.left_aversive_orns: Dict[str, Set[int]] = {}
        self.right_aversive_orns: Dict[str, Set[int]] = {}
        
        self._find_bilateral_neurons()
    
    def _find_bilateral_neurons(self):
        """Find olfactory neurons with L/R side annotations."""
        glom_names = list(GLOMERULUS_TUNING.keys())
        aversive_glom_names = list(AVERSIVE_GLOMERULUS_TUNING.keys())
        
        for glom in glom_names:
            self.left_orns[glom] = set()
            self.right_orns[glom] = set()
            self.left_pns[glom] = set()
            self.right_pns[glom] = set()
        
        for glom in aversive_glom_names:
            self.left_aversive_orns[glom] = set()
            self.right_aversive_orns[glom] = set()
        
        # Find excitatory LH→motor neurons (attraction)
        for body_id in EXCITATORY_LH_MOTOR["L"]:
            if body_id in self.body_to_idx:
                self.left_excitatory_lh.add(body_id)
        for body_id in EXCITATORY_LH_MOTOR["R"]:
            if body_id in self.body_to_idx:
                self.right_excitatory_lh.add(body_id)
        
        # Find inhibitory LH→motor neurons (aversion)
        for body_id in INHIBITORY_LH_MOTOR["L"]:
            if body_id in self.body_to_idx:
                self.left_inhibitory_lh.add(body_id)
        for body_id in INHIBITORY_LH_MOTOR["R"]:
            if body_id in self.body_to_idx:
                self.right_inhibitory_lh.add(body_id)
        
        print(f"  EXCITATORY LH→motor (attraction): L={len(self.left_excitatory_lh)}, R={len(self.right_excitatory_lh)}")
        print(f"  INHIBITORY LH→motor (aversion): L={len(self.left_inhibitory_lh)}, R={len(self.right_inhibitory_lh)}")
        
        for _, row in self.annotations.iterrows():
            body_id = row["bodyId"]
            if body_id not in self.body_to_idx:
                continue
            
            cell_type = str(row["type"]) if pd.notna(row["type"]) else ""
            side = str(row["somaSide"]).upper() if pd.notna(row["somaSide"]) else ""
            
            if not cell_type:
                continue
            
            # Attractive ORNs/PNs
            for glom in glom_names:
                if cell_type == f"ORN_{glom}":
                    if side == "L":
                        self.left_orns[glom].add(body_id)
                    elif side == "R":
                        self.right_orns[glom].add(body_id)
                    else:
                        if body_id % 2 == 0:
                            self.left_orns[glom].add(body_id)
                        else:
                            self.right_orns[glom].add(body_id)
                
                elif cell_type.startswith(f"{glom}_") and "PN" in cell_type:
                    if side == "L":
                        self.left_pns[glom].add(body_id)
                    elif side == "R":
                        self.right_pns[glom].add(body_id)
            
            # Aversive ORNs (acid-sensing glomeruli)
            for glom in aversive_glom_names:
                if cell_type == f"ORN_{glom}":
                    if side == "L":
                        self.left_aversive_orns[glom].add(body_id)
                    elif side == "R":
                        self.right_aversive_orns[glom].add(body_id)
                    else:
                        if body_id % 2 == 0:
                            self.left_aversive_orns[glom].add(body_id)
                        else:
                            self.right_aversive_orns[glom].add(body_id)
        
        total_l_orns = sum(len(v) for v in self.left_orns.values())
        total_r_orns = sum(len(v) for v in self.right_orns.values())
        total_l_pns = sum(len(v) for v in self.left_pns.values())
        total_r_pns = sum(len(v) for v in self.right_pns.values())
        total_l_aversive = sum(len(v) for v in self.left_aversive_orns.values())
        total_r_aversive = sum(len(v) for v in self.right_aversive_orns.values())
        
        print(f"  Attractive olfactory neurons in subgraph:")
        print(f"    ORNs: L={total_l_orns}, R={total_r_orns}")
        print(f"    PNs: L={total_l_pns}, R={total_r_pns}")
        print(f"  Aversive olfactory neurons in subgraph:")
        print(f"    ORNs: L={total_l_aversive}, R={total_r_aversive}")
    
    def compute_antenna_positions(
        self,
        fly_x: float,
        fly_y: float,
        fly_theta: float,
    ) -> Tuple[Tuple[float, float], Tuple[float, float]]:
        """Compute left and right antenna positions given fly pose."""
        perp_x = -np.sin(fly_theta)
        perp_y = np.cos(fly_theta)
        fwd_x = np.cos(fly_theta) * self.ANTENNA_OFFSET * 0.5
        fwd_y = np.sin(fly_theta) * self.ANTENNA_OFFSET * 0.5
        
        left_x = fly_x + fwd_x + perp_x * self.ANTENNA_OFFSET
        left_y = fly_y + fwd_y + perp_y * self.ANTENNA_OFFSET
        right_x = fly_x + fwd_x - perp_x * self.ANTENNA_OFFSET
        right_y = fly_y + fwd_y - perp_y * self.ANTENNA_OFFSET
        
        return (left_x, left_y), (right_x, right_y)
    
    def get_bilateral_odor_currents(
        self,
        fly_x: float,
        fly_y: float,
        fly_theta: float,
        odor_sources: List,
        odor_blend: Optional[Dict[str, float]] = None,
        base_current: float = 1.0,
    ) -> Dict[int, float]:
        """
        Compute bilateral external currents based on spatial odor field.
        
        CRITICAL: Strong injection to EXCITATORY LH→motor neurons.
        These are cholinergic and EXCITE DNs → drive ATTRACTION.
        """
        if not odor_sources:
            return {}
        
        if odor_blend is None:
            odor_blend = FRUIT_ESTER_BLEND
        
        (left_x, left_y), (right_x, right_y) = self.compute_antenna_positions(
            fly_x, fly_y, fly_theta
        )
        
        left_conc = sum(s.concentration(left_x, left_y) for s in odor_sources)
        right_conc = sum(s.concentration(right_x, right_y) for s in odor_sources)
        
        glom_response = compute_glomerulus_response(odor_blend)
        avg_activation = sum(glom_response.values()) / len(glom_response)
        
        currents = {}
        
        # EXCITATORY LH→motor neurons - STRONGEST injection
        # These are cholinergic, so activating them EXCITES ipsilateral DNs
        # → drives fly TOWARD the odor source
        lh_multiplier = 8.0  # Strong injection
        for body_id in self.left_excitatory_lh:
            currents[body_id] = left_conc * avg_activation * base_current * lh_multiplier
        for body_id in self.right_excitatory_lh:
            currents[body_id] = right_conc * avg_activation * base_current * lh_multiplier
        
        # ORNs and PNs at glomeruli (weaker, feed into pathway)
        for glom, activation in glom_response.items():
            if activation <= 0:
                continue
            
            left_current = activation * left_conc * base_current
            right_current = activation * right_conc * base_current
            
            for body_id in self.left_orns.get(glom, set()):
                currents[body_id] = currents.get(body_id, 0) + left_current
            for body_id in self.right_orns.get(glom, set()):
                currents[body_id] = currents.get(body_id, 0) + right_current
            
            for body_id in self.left_pns.get(glom, set()):
                currents[body_id] = currents.get(body_id, 0) + left_current * 0.8
            for body_id in self.right_pns.get(glom, set()):
                currents[body_id] = currents.get(body_id, 0) + right_current * 0.8
        
        return currents
    
    def get_bilateral_aversive_currents(
        self,
        fly_x: float,
        fly_y: float,
        fly_theta: float,
        odor_sources: List,
        odor_blend: Optional[Dict[str, float]] = None,
        base_current: float = 1.0,
    ) -> Dict[int, float]:
        """
        Compute bilateral external currents for AVERSIVE chemotaxis.
        
        CRITICAL: Inject to INHIBITORY LH→motor neurons (GABAergic).
        These inhibit ipsilateral DNs → contralateral side dominates → turn AWAY.
        
        This is PURE GRAPH aversion — no external turn-away vector.
        
        LHAD1g1 is the primary aversive neuron:
        - GABAergic (inhibitory)
        - Strongest LH→DN output (~1700 weight)
        - When activated, suppresses motor output on that side
        """
        if not odor_sources:
            return {}
        
        if odor_blend is None:
            odor_blend = VINEGAR_BLEND
        
        (left_x, left_y), (right_x, right_y) = self.compute_antenna_positions(
            fly_x, fly_y, fly_theta
        )
        
        # Sample concentration at each antenna
        left_conc = sum(s.concentration(left_x, left_y) for s in odor_sources)
        right_conc = sum(s.concentration(right_x, right_y) for s in odor_sources)
        
        # Compute aversive glomerulus response
        glom_response = compute_aversive_glomerulus_response(odor_blend)
        avg_activation = sum(glom_response.values()) / max(1, len(glom_response))
        
        currents = {}
        
        # INHIBITORY LH→motor neurons - PRIMARY aversive pathway
        # These are GABAergic, so activating them INHIBITS ipsilateral DNs
        # → contralateral side dominates → fly turns AWAY from odor source
        #
        # More vinegar on LEFT → inject to LEFT inhibitory LH
        # → LEFT DNs inhibited → RIGHT dominates → turn RIGHT (away)
        lh_multiplier = 10.0  # Strong injection to inhibitory pathway
        
        for body_id in self.left_inhibitory_lh:
            currents[body_id] = left_conc * avg_activation * base_current * lh_multiplier
        for body_id in self.right_inhibitory_lh:
            currents[body_id] = right_conc * avg_activation * base_current * lh_multiplier
        
        # Aversive ORNs (acid-sensing, weaker contribution)
        for glom, activation in glom_response.items():
            if activation <= 0:
                continue
            
            left_current = activation * left_conc * base_current * 0.5
            right_current = activation * right_conc * base_current * 0.5
            
            for body_id in self.left_aversive_orns.get(glom, set()):
                currents[body_id] = currents.get(body_id, 0) + left_current
            for body_id in self.right_aversive_orns.get(glom, set()):
                currents[body_id] = currents.get(body_id, 0) + right_current
        
        return currents
    
    def get_injection_summary(self) -> Dict:
        """Get summary of bilateral injection targets."""
        return {
            "left_excitatory_lh": len(self.left_excitatory_lh),
            "right_excitatory_lh": len(self.right_excitatory_lh),
            "left_inhibitory_lh": len(self.left_inhibitory_lh),
            "right_inhibitory_lh": len(self.right_inhibitory_lh),
            "left_orns": sum(len(v) for v in self.left_orns.values()),
            "right_orns": sum(len(v) for v in self.right_orns.values()),
            "left_pns": sum(len(v) for v in self.left_pns.values()),
            "right_pns": sum(len(v) for v in self.right_pns.values()),
            "left_aversive_orns": sum(len(v) for v in self.left_aversive_orns.values()),
            "right_aversive_orns": sum(len(v) for v in self.right_aversive_orns.values()),
        }


OlfactoryInjector = BilateralOlfactoryInjector
