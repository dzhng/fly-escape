"""
Landing and feeding behaviors for Drosophila simulation.

## LANDING (⚠️ LOOM DETECTION IS A SOFT STUB)
Visual loom (expanding image) triggers landing via landing DNs (DNp07, DNp10).
The loom signal is computed as dR/dt where R is retinal size (angle subtended
by the fruit). This is NOT a distance threshold - it's a visual expansion rate
that increases as the fly approaches AND speeds up toward the object.

**STUB NOTE:** The loom SIGNAL is computed mathematically, not from visual neurons.
True loom detection would require LC neurons (in MaleCNS but not motor1hop subgraph).
The DN INJECTION path is through the graph (pure), but loom detection is external.
See SPIKE_LEARNINGS.md and BALANCE.md section 4b for details.

## FEEDING  
Tarsal contact with fruit triggers sugar taste signal to gustatory neurons
(claw_tpGRN). Successful feeding activates proboscis motor neurons (MN1 in GNG).

## HUNGER
Hunger state modulates feeding pathway gain (Drosophila literature: starved
flies show enhanced feeding initiation, higher sugar sensitivity). Ref:
- Inagaki et al. 2012 - "Optogenetic control of Drosophila using a
  red-shifted channelrhodopsin"
- Pool & Scott 2014 - "Feeding regulation in Drosophila"

CRITICAL: No distance thresholds for landing/feeding. All behaviors emerge
from neural circuit activation:
- Landing: visual loom → landing DNs → reduced thrust, extended legs
- Feeding: tarsal sugar contact → GRN → SEZ interneurons → proboscis MNs
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, Set, List, Tuple, Optional
from enum import Enum


class FlyBehaviorState(Enum):
    """Behavioral state of the fly (dual-mode locomotion)."""
    WALKING = "walking"    # Ground locomotion - slow, precise
    FLYING = "flying"      # Aerial locomotion - fast, momentum
    LANDING = "landing"    # Transitioning from flight to ground
    LANDED = "landed"      # On fruit/ground, ready to feed
    FEEDING = "feeding"    # Actively feeding
    DEAD = "dead"          # Starved


# Flight INITIATION DNs - trigger takeoff when activated by hunger/threat
# SPIKE: DNb01/DNb02 are known flight initiation neurons (Namiki et al. 2018)
# DNg13/DNg14 are wing power neurons that support sustained flight
TAKEOFF_DN_LEFT = [
    10654,   # DNb01_L - primary flight initiation
    12767,   # DNb02_L
    529488,  # DNb02_L
    11074,   # DNg13_L - wing power
    524225,  # DNg14_L
]

TAKEOFF_DN_RIGHT = [
    10759,   # DNb01_R - primary flight initiation
    10805,   # DNb02_R
    13922,   # DNb02_R
    512006,  # DNg13_R - wing power
    12224,   # DNg14_R
]


@dataclass
class HungerState:
    """
    Hunger state with feeding pathway modulation.
    
    Based on Drosophila feeding literature:
    - Starved flies show 2-3x higher sugar response (Wang et al. 2004)
    - Insulin signaling modulates feeding initiation (Wu et al. 2005)
    - Hugin neurons gate feeding behavior
    - Starved flies show increased locomotion/search (Krashes et al. 2009)
    
    TWO SEPARATE GAINS (biologically distinct):
    1. feeding_gain: Sugar→proboscis pathway (post-contact)
    2. olfactory_gain: Hunger→approach motivation (pre-contact)
    """
    level: float = 1.0             # 1.0 = fully hungry, 0.0 = satiated
    
    # Base multipliers (can be overridden)
    base_feeding_gain: float = 2.0    # Default 2x when hungry
    base_olfactory_gain: float = 1.0  # Default 1x (no extra olfactory boost)
    
    @property
    def feeding_gain(self) -> float:
        """Gain on sugar→proboscis pathway (affects feeding initiation)."""
        return 1.0 + self.level * (self.base_feeding_gain - 1.0)
    
    @property
    def olfactory_gain(self) -> float:
        """Gain on hunger→olfactory pathway (affects approach speed)."""
        return 1.0 + self.level * (self.base_olfactory_gain - 1.0)
    
    def update_from_feeding(self, feed_amount: float = 0.3):
        """Reduce hunger after successful feeding."""
        self.level = max(0.0, self.level - feed_amount)
    
    def update_from_time(self, dt: float, rate: float = 0.0001):
        """Slowly increase hunger over time."""
        self.level = min(1.0, self.level + rate * dt)


# Landing DN body IDs from MaleCNS (verified present in subgraph)
LANDING_DN_LEFT = [
    11704,   # DNp07 L
    10425,   # DNp10 L
]

LANDING_DN_RIGHT = [
    11513,   # DNp07 R
    10433,   # DNp10 R
]

# Additional landing-related DNs
LANDING_DN_EXTRA_LEFT = [
    10228,   # DNp06 L
    10783,   # DNp09 L (also flight power, dual role)
]

LANDING_DN_EXTRA_RIGHT = [
    10584,   # DNp06 R
    11177,   # DNp09 R
]

# Gustatory receptor neurons (tarsal - detect sugar on landing)
# claw_tpGRN - tarsal gustatory neurons on leg claws
TARSAL_GRN_IDS = [
    146756, 146880, 149384, 151220, 156079, 156512, 157030, 157131,
    157398, 158200, 159466, 159854, 160114, 160450, 160475, 161040,
    161485, 163001, 163239, 163469, 164437, 166316, 166816, 167313,
    169896, 170350, 170643, 171047, 173010, 175078, 176139, 178033,
]

# BM_Taste neurons (broad taste neurons)
BM_TASTE_IDS = [
    25582, 35051, 36952, 38419, 46278, 53919, 55745, 64924,
    66710, 71593, 72348, 74834, 76843, 81744, 83902, 85753,
]

# Proboscis motor neurons (MN1 in GNG - control proboscis extension)
PROBOSCIS_MN_IDS = [
    11084,      # MN1 L
    15530,      # MN1 L
    580748,     # MN1 R
    102317324,  # MN1 R
]

# GNG interneurons (SEZ feeding circuit)
GNG_INTERNEURON_IDS = [
    10849, 11755, 10960, 24857, 10964, 13799, 10970, 12972, 11025, 12962,
]

# Hugin neurons (feeding modulation, inhibit during satiation)
HUGIN_IDS = [17819, 18794, 124747]

# NPF neurons (hunger-related neuropeptide)
NPF_IDS = [12271, 14605]


# AOTU neurons - SCOTOTAXIS (shadow preference) via DNa02/DNa03
# SPIKE FINDING: AOTU→DNa02/DNa03 produces IPSILATERAL activation
# This creates NEGATIVE PHOTOTAXIS (turn away from light / toward shadow)
# 81% coverage in visual_motor subgraph (251/311 neurons)
AOTU_LEFT = [
    10070, 10148, 10212, 10219, 10502, 10526, 10636, 10875, 10878, 11370,
    11445, 11808, 11831, 12007, 12017, 12391, 12568, 12627, 13419, 13970,
    14368, 14373, 15198, 15854, 15885, 18112, 18313, 18388, 19331, 19369,
    19686, 20266, 21025, 21162, 23775, 23835, 25830, 26256, 26342, 27730,
    27776, 28464, 32894, 33416, 33992, 35400, 36878, 40228, 46259, 46835,
    47433, 48388, 48629, 49100, 49226, 52366, 53403, 53587, 54999, 61327,
    63381, 65281, 68617, 74075, 74503, 75299, 75501, 78336, 83676, 84547,
    87360, 90422, 93365, 97195, 98871, 98923, 99580, 99646, 100548, 102413,
    103004, 103319, 103686, 104312, 106493, 111000, 117269, 117740, 119700, 121558,
    121755, 122434, 122986, 123245, 123762, 125157, 128237, 128740, 134842, 141121,
    151411, 153474, 154952, 156429, 161331, 169402, 169799, 187933, 218021, 511953,
    513158, 514420, 514422, 514490, 515371, 516079, 516223, 516360, 516361, 516362,
    516363, 516429, 517110, 517465, 517788, 518450, 518549, 518657, 519901, 519917,
    520080, 520903, 520905, 521022, 521220, 521650, 524007, 525266, 527587, 527589,
    529271, 529959, 531093, 531134, 531863, 543277, 547498, 550121, 551244, 552128,
    553807, 555278, 557095, 382559434,
]  # 154 L neurons

AOTU_RIGHT = [
    10005, 10031, 10239, 10406, 10410, 10774, 10850, 11185, 11196, 11571,
    11764, 11787, 12051, 12084, 12792, 12855, 13330, 13441, 14365, 14411,
    14751, 15319, 15548, 15606, 15712, 15927, 16340, 16432, 17436, 17461,
    17827, 17953, 17994, 18026, 18138, 18146, 18335, 18720, 18864, 19066,
    19563, 19929, 19961, 20096, 20205, 20280, 20447, 20582, 20747, 20784,
    21241, 21271, 21375, 21747, 21886, 22315, 22434, 23509, 23536, 24266,
    25023, 25129, 25657, 25860, 26164, 26199, 26320, 26826, 27273, 27356,
    28227, 28671, 28922, 29196, 29534, 29622, 29715, 30104, 30280, 30771,
    31100, 33122, 34101, 34350, 34357, 35228, 35728, 36047, 36409, 36578,
    36979, 37410, 37623, 37829, 37919, 38222, 38915, 39049, 39336, 40643,
    41631, 42283, 43376, 43873, 44511, 45253, 45806, 46817, 49686, 50539,
    51470, 53041, 53624, 54864, 54997, 56100, 65738, 66210, 66291, 67228,
    69478, 70921, 71967, 76393, 82711, 82845, 83962, 87420, 87708, 87720,
    93468, 95690, 97375, 104734, 107894, 108026, 112538, 122262, 122713, 123833,
    124940, 130029, 140612, 141537, 141703, 151869, 422508, 519926, 521594, 523317,
    524268, 524646, 531808, 555277, 555803, 565505, 902249,
]  # 157 R neurons


# LC4 neurons - ESCAPE looming detectors (100% in visual_motor subgraph)
# SPIKE FINDING: LC4→DNp04 pathway is STRONGLY active (+829% spike increase)
# These neurons detect fast/large looming stimuli and trigger escape via Giant Fiber
LC4_LEFT = [
    12032, 12349, 12824, 14888, 15018, 16809, 16917, 17270, 17340, 17478,
    17608, 17653, 18396, 18432, 18478, 20440, 20572, 20859, 20967, 20976,
    21721, 22772, 22922, 23202, 23226, 24523, 27624, 27750, 27829, 28980,
    29417, 29469, 29514, 30087, 31301, 31308, 31429, 32597, 33137, 34845,
    35262, 35616, 37587, 77614, 81112, 100485, 107513, 111787, 511914, 512366,
    512705, 514508, 514956, 515476, 515900, 516909, 517752, 518016, 518439,
    518544, 518730, 518983, 519650, 519931, 520449, 524899, 526286, 530029,
    532254, 533129, 535341,  # 71 L side neurons
]

LC4_RIGHT = [
    16128, 16138, 16628, 17054, 17266, 17364, 17548, 17668, 17860, 17926,
    17987, 18127, 18189, 19260, 19420, 19543, 19550, 19634, 19794, 19954,
    20016, 20282, 20399, 20542, 20588, 20673, 20808, 20917, 21151, 21165,
    21225, 21287, 21313, 21336, 21804, 22034, 22194, 22328, 22847, 22966,
    22975, 23098, 23392, 23792, 23929, 24338, 25584, 26112, 28945, 29563,
    30480, 30803, 31262, 38065, 527408,  # 55 R side neurons
]


@dataclass
class LandingFeedingParams:
    """Parameters for landing, feeding, and takeoff behaviors."""
    # Loom computation (LANDING - slow approach to fruit)
    fruit_radius: float = 20.0        # Assumed fruit radius (pixels)
    loom_threshold: float = 0.02      # Loom rate threshold (lowered for easier landing)
    loom_gain: float = 15.0           # Gain for loom → DN injection (increased)
    
    # ESCAPE loom (THREAT - fast/large expanding stimulus)
    # SPIKE: LC4→DNp04 pathway enables pure-graph escape
    escape_loom_threshold: float = 0.08   # Higher than landing (fast expand only)
    escape_loom_gain: float = 20.0        # Gain for loom → LC4 injection
    threat_radius: float = 50.0           # Assumed threat visual size (larger than fruit)
    
    # TAKEOFF gates (SPIKE: Hunger/threat → flight initiation DNs)
    # DNb01/DNb02 are known flight initiation neurons (Namiki et al.)
    takeoff_hunger_threshold: float = 0.6   # Hunger level to start boosting takeoff
    takeoff_hunger_gain: float = 8.0        # Hunger → takeoff DN injection
    takeoff_threat_gain: float = 15.0       # Threat escape → takeoff boost
    takeoff_dn_threshold: float = 0.4       # DN activity threshold to trigger actual takeoff
    
    # SCOTOTAXIS (shadow preference) via AOTU
    # SPIKE: AOTU→DNa02/DNa03 produces ipsilateral turning (negative phototaxis)
    # Shadow on L → AOTU_L → turn R → toward shadow
    aotu_gain: float = 10.0           # Shadow strength → AOTU injection current
    shadow_threshold: float = 0.1     # Min shadow intensity to trigger
    eye_offset: float = 15.0          # Bilateral eye offset from center (like antenna)
    
    # Landing
    landing_thrust_reduction: float = 0.85  # Reduce thrust during landing
    landing_settle_time: int = 20     # Steps to fully land (faster)
    
    # Feeding
    contact_radius: float = 30.0      # Distance for tarsal contact (larger)
    feeding_time: int = 40            # Steps for one feeding bout
    sugar_gain: float = 12.0          # Gain for sugar → GRN injection (stronger!)
    
    # Starvation
    starve_time_steps: int = 3000     # 5 min at 0.1s/step = 3000 steps
    step_to_seconds: float = 0.1      # Map sim step to wall-clock seconds


class LandingFeedingSystem:
    """
    Landing and feeding behavior system.
    
    Visual loom → landing DNs → landing behavior
    Tarsal sugar → gustatory neurons → proboscis MNs → feeding
    
    CRITICAL: No distance-based thresholds. Landing triggered by LOOM SIGNAL
    (visual expansion rate), not raw distance.
    
    GAIN PARAMETERS (for sweep experiments):
    - feeding_gain: Affects sugar→proboscis pathway (post-contact feeding)
    - olfactory_gain: Affects hunger→approach motivation (pre-contact approach)
    """
    
    def __init__(
        self,
        body_to_idx: Dict[int, int],
        params: Optional[LandingFeedingParams] = None,
        feeding_gain: float = 2.0,
        olfactory_gain: float = 1.0,
    ):
        self.body_to_idx = body_to_idx
        self.params = params or LandingFeedingParams()
        
        # Store gain settings for hunger initialization
        self._feeding_gain = feeding_gain
        self._olfactory_gain = olfactory_gain
        
        # Index neurons that are in the subgraph
        self.landing_dn_left_idx = [body_to_idx[b] for b in LANDING_DN_LEFT if b in body_to_idx]
        self.landing_dn_right_idx = [body_to_idx[b] for b in LANDING_DN_RIGHT if b in body_to_idx]
        self.landing_dn_extra_left = [body_to_idx[b] for b in LANDING_DN_EXTRA_LEFT if b in body_to_idx]
        self.landing_dn_extra_right = [body_to_idx[b] for b in LANDING_DN_EXTRA_RIGHT if b in body_to_idx]
        
        self.tarsal_grn_idx = [body_to_idx[b] for b in TARSAL_GRN_IDS if b in body_to_idx]
        self.bm_taste_idx = [body_to_idx[b] for b in BM_TASTE_IDS if b in body_to_idx]
        self.proboscis_mn_idx = [body_to_idx[b] for b in PROBOSCIS_MN_IDS if b in body_to_idx]
        self.gng_interneuron_idx = [body_to_idx[b] for b in GNG_INTERNEURON_IDS if b in body_to_idx]
        self.hugin_idx = [body_to_idx[b] for b in HUGIN_IDS if b in body_to_idx]
        self.npf_idx = [body_to_idx[b] for b in NPF_IDS if b in body_to_idx]
        
        # AOTU neurons for scototaxis (shadow preference)
        self.aotu_left_idx = [body_to_idx[b] for b in AOTU_LEFT if b in body_to_idx]
        self.aotu_right_idx = [body_to_idx[b] for b in AOTU_RIGHT if b in body_to_idx]
        
        # Takeoff DNs for flight initiation (hunger/threat → takeoff)
        self.takeoff_dn_left_idx = [body_to_idx[b] for b in TAKEOFF_DN_LEFT if b in body_to_idx]
        self.takeoff_dn_right_idx = [body_to_idx[b] for b in TAKEOFF_DN_RIGHT if b in body_to_idx]
        
        print(f"  Landing DNs indexed: L={len(self.landing_dn_left_idx)}, R={len(self.landing_dn_right_idx)}")
        print(f"  Takeoff DNs indexed: L={len(self.takeoff_dn_left_idx)}, R={len(self.takeoff_dn_right_idx)}")
        print(f"  Tarsal GRNs indexed: {len(self.tarsal_grn_idx)}")
        print(f"  Proboscis MNs indexed: {len(self.proboscis_mn_idx)}")
        print(f"  GNG interneurons indexed: {len(self.gng_interneuron_idx)}")
        print(f"  AOTU indexed (scototaxis): L={len(self.aotu_left_idx)}, R={len(self.aotu_right_idx)}")
        print(f"  Hunger gains: feeding={feeding_gain}x, olfactory={olfactory_gain}x")
        
        # State - initialize with configured gains
        self.hunger = HungerState(
            base_feeding_gain=self._feeding_gain,
            base_olfactory_gain=self._olfactory_gain,
        )
        self.behavior_state = FlyBehaviorState.FLYING
        self.landing_progress = 0
        self.feeding_progress = 0
        self.total_steps = 0
        self.fed_count = 0
        
        # Loom history for temporal derivative
        self._prev_retinal_size = 0.0
        self._prev_distance = float('inf')
    
    def reset(self, start_flying: bool = False):
        """Reset to initial state.
        
        Args:
            start_flying: If True, start in FLYING state; else start WALKING
        """
        self.hunger = HungerState(
            base_feeding_gain=self._feeding_gain,
            base_olfactory_gain=self._olfactory_gain,
        )
        # Default: Start WALKING (dual-mode locomotion)
        # Set start_flying=True to bypass walk→fly transition
        self.behavior_state = FlyBehaviorState.FLYING if start_flying else FlyBehaviorState.WALKING
        self.landing_progress = 0
        self.feeding_progress = 0
        self.total_steps = 0
        self.fed_count = 0
        self._prev_retinal_size = 0.0
        self._prev_distance = float('inf')
    
    def compute_loom_signal(
        self,
        fly_x: float,
        fly_y: float,
        fly_vx: float,
        fly_vy: float,
        fruit_x: float,
        fruit_y: float,
    ) -> Tuple[float, float]:
        """
        ⚠️ SOFT STUB: Compute visual loom signal MATHEMATICALLY.
        
        TRUE loom detection would require:
        - R7/R8 photoreceptors receiving visual input
        - Medulla processing
        - LC neurons (LC4, LC6, LC16) computing loom
        - LC → DN pathway to landing DNs
        These exist in MaleCNS but are NOT in motor1hop subgraph.
        See SPIKE_LEARNINGS.md and BALANCE.md section 4b for details.
        
        Current implementation:
        Loom = dR/dt where R is the retinal angle subtended by the object.
        R ≈ 2 * arctan(object_radius / distance)
        dR/dt depends on both distance AND approach velocity.
        
        The loom SIGNAL is computed externally, but DN INJECTION goes through graph.
        
        Returns:
            (loom_signal, distance)
        """
        dx = fly_x - fruit_x
        dy = fly_y - fruit_y
        distance = np.sqrt(dx * dx + dy * dy)
        
        if distance < 1.0:
            distance = 1.0
        
        retinal_size = 2.0 * np.arctan(self.params.fruit_radius / distance)
        
        d_retinal = retinal_size - self._prev_retinal_size
        
        approach_velocity = 0.0
        if distance < self._prev_distance:
            fly_to_fruit_x = fruit_x - fly_x
            fly_to_fruit_y = fruit_y - fly_y
            norm = np.sqrt(fly_to_fruit_x**2 + fly_to_fruit_y**2)
            if norm > 0.1:
                fly_to_fruit_x /= norm
                fly_to_fruit_y /= norm
                approach_velocity = fly_vx * fly_to_fruit_x + fly_vy * fly_to_fruit_y
        
        looming_velocity = self.params.fruit_radius * approach_velocity / (distance ** 2)
        
        loom_signal = max(0, d_retinal + looming_velocity * 0.1)
        
        self._prev_retinal_size = retinal_size
        self._prev_distance = distance
        
        return loom_signal, distance
    
    def compute_tarsal_contact(
        self,
        fly_x: float,
        fly_y: float,
        fruit_x: float,
        fruit_y: float,
    ) -> float:
        """
        Compute tarsal (leg) contact with fruit surface.
        
        This is a physical contact signal, not a neural threshold.
        Contact strength depends on overlap between leg reach and fruit surface.
        
        Returns:
            contact_strength (0.0 to 1.0)
        """
        dx = fly_x - fruit_x
        dy = fly_y - fruit_y
        distance = np.sqrt(dx * dx + dy * dy)
        
        if distance > self.params.contact_radius:
            return 0.0
        
        overlap = 1.0 - (distance / self.params.contact_radius)
        return min(1.0, overlap)
    
    def get_landing_currents(
        self,
        loom_signal: float,
        fly_theta: float,
    ) -> Dict[int, float]:
        """
        Compute currents to inject to landing DNs based on loom signal.
        
        Landing DNs (DNp07, DNp10) are activated by visual loom.
        The signal is bilateral but can have L/R asymmetry based on
        which side of visual field the looming object is in.
        
        For simplicity, we inject symmetrically since fly is approaching head-on.
        """
        if loom_signal < self.params.loom_threshold:
            return {}
        
        if self.behavior_state == FlyBehaviorState.DEAD:
            return {}
        
        current = loom_signal * self.params.loom_gain
        
        currents = {}
        
        for idx in self.landing_dn_left_idx:
            body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
            currents[body_id] = current
        
        for idx in self.landing_dn_right_idx:
            body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
            currents[body_id] = current
        
        for idx in self.landing_dn_extra_left + self.landing_dn_extra_right:
            body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
            currents[body_id] = current * 0.5
        
        return currents
    
    def compute_escape_loom(
        self,
        fly_x: float,
        fly_y: float,
        fly_vx: float,
        fly_vy: float,
        threat_x: float,
        threat_y: float,
        threat_radius: Optional[float] = None,
    ) -> Tuple[float, float]:
        """
        ✅ ESCAPE LOOM: Compute loom signal from approaching THREAT.
        
        Escape loom is similar to landing loom but:
        - Uses larger assumed object size (threat_radius)
        - Higher threshold (only fast-expanding triggers escape)
        - Injects to LC4 neurons (visual layer) instead of directly to landing DNs
        
        SPIKE FINDING: LC4→DNp04 pathway produces +829% escape DN spike increase.
        This is PURE GRAPH escape (geometric loom → LC4 → graph → escape DNs).
        
        Returns:
            (escape_loom_signal, distance)
        """
        radius = threat_radius if threat_radius else self.params.threat_radius
        
        dx = fly_x - threat_x
        dy = fly_y - threat_y
        distance = np.sqrt(dx * dx + dy * dy)
        
        if distance < 1.0:
            distance = 1.0
        
        retinal_size = 2.0 * np.arctan(radius / distance)
        
        if not hasattr(self, '_prev_threat_retinal'):
            self._prev_threat_retinal = retinal_size
            self._prev_threat_distance = distance
        
        d_retinal = retinal_size - self._prev_threat_retinal
        
        approach_velocity = 0.0
        if distance < self._prev_threat_distance:
            fly_to_threat_x = threat_x - fly_x
            fly_to_threat_y = threat_y - fly_y
            norm = np.sqrt(fly_to_threat_x**2 + fly_to_threat_y**2)
            if norm > 0.1:
                fly_to_threat_x /= norm
                fly_to_threat_y /= norm
                approach_velocity = fly_vx * fly_to_threat_x + fly_vy * fly_to_threat_y
        
        looming_velocity = radius * approach_velocity / (distance ** 2)
        
        escape_loom = max(0, d_retinal + looming_velocity * 0.1)
        
        self._prev_threat_retinal = retinal_size
        self._prev_threat_distance = distance
        
        return escape_loom, distance
    
    def get_escape_currents(
        self,
        escape_loom: float,
        threat_angle: Optional[float] = None,
    ) -> Dict[int, float]:
        """
        ✅ PURE GRAPH ESCAPE: Inject to LC4 neurons based on escape loom.
        
        SPIKE FINDING: LC4→DNp04 pathway is STRONGLY active.
        - LC4 neurons detect fast/large looming (escape triggers)
        - DNp04 is the Giant Fiber target for escape response
        - Tested: +829% escape DN spike increase with LC4 injection
        
        Interface:
        - Input: Geometric escape_loom signal + optional threat_angle
        - Injection: LC4 neurons (visual layer, NOT directly to DNs)
        - Graph handles: LC4 → DNp04 → motor pathway
        
        BILATERAL ESCAPE: If threat_angle is provided, inject more to the
        side closer to the threat. This creates asymmetric LC4 activation
        that may produce turning away (contralateral side dominates).
        
        threat_angle: angle from fly to threat relative to fly heading
                     0 = threat ahead, +π/2 = threat on right, -π/2 = left
        """
        if escape_loom < self.params.escape_loom_threshold:
            return {}
        
        if self.behavior_state == FlyBehaviorState.DEAD:
            return {}
        
        base_current = escape_loom * self.params.escape_loom_gain
        
        # Compute bilateral asymmetry based on threat position
        if threat_angle is not None:
            # Threat on right (+angle) → more R LC4 → inhibit R motor → turn left (away)
            # Threat on left (-angle) → more L LC4 → inhibit L motor → turn right (away)
            asymmetry = np.clip(np.sin(threat_angle), -1, 1)
            left_current = base_current * (1.0 - asymmetry * 0.5)  # Less if threat on right
            right_current = base_current * (1.0 + asymmetry * 0.5)  # More if threat on right
        else:
            left_current = base_current
            right_current = base_current
        
        currents = {}
        
        # Inject to LC4 neurons (visual layer) with bilateral asymmetry
        for body_id in LC4_LEFT:
            if body_id in self.body_to_idx:
                currents[body_id] = left_current
        
        for body_id in LC4_RIGHT:
            if body_id in self.body_to_idx:
                currents[body_id] = right_current
        
        return currents
    
    def get_scototaxis_currents(
        self,
        fly_x: float,
        fly_y: float,
        fly_theta: float,
        shadow_sources: List[Tuple[float, float, float, float]],  # [(x, y, intensity, sigma), ...]
        light_sources: List[Tuple[float, float, float, float]] = None,  # Optional light avoidance
    ) -> Dict[int, float]:
        """
        ✅ PURE GRAPH SCOTOTAXIS: Compute AOTU injection for shadow preference.
        
        SPIKE FINDING: AOTU→DNa02/DNa03 produces IPSILATERAL activation.
        - AOTU_L injection → L DN spikes → turn RIGHT
        - AOTU_R injection → R DN spikes → turn LEFT
        
        This creates NEGATIVE PHOTOTAXIS (turn away from light stimulus).
        We use this for SHADOW PREFERENCE (scototaxis):
        - Shadow on LEFT → inject AOTU_L → turn RIGHT → TOWARD shadow ✅
        - Shadow on RIGHT → inject AOTU_R → turn LEFT → TOWARD shadow ✅
        
        Detection: Geometric (shadow field intensity at bilateral "eye" positions)
        Injection: AOTU neurons (visual layer) → graph → DNa02/DNa03 → motor
        
        Args:
            fly_x, fly_y: Fly position
            fly_theta: Fly heading (radians, 0=right)
            shadow_sources: List of (x, y, intensity, sigma) shadow zones
            light_sources: Optional list of light sources to avoid
            
        Returns:
            Dict mapping body_id → injection current
        """
        if self.behavior_state == FlyBehaviorState.DEAD:
            return {}
        
        # Bilateral "eye" positions (like antenna offset for olfaction)
        eye_offset = self.params.eye_offset
        sin_theta = np.sin(fly_theta)
        cos_theta = np.cos(fly_theta)
        
        # Left eye is perpendicular-left from heading
        left_eye_x = fly_x - eye_offset * sin_theta
        left_eye_y = fly_y + eye_offset * cos_theta
        
        # Right eye is perpendicular-right from heading
        right_eye_x = fly_x + eye_offset * sin_theta
        right_eye_y = fly_y - eye_offset * cos_theta
        
        # Compute shadow intensity at each eye
        def compute_intensity(eye_x, eye_y, sources):
            total = 0.0
            for sx, sy, intensity, sigma in sources:
                dx = eye_x - sx
                dy = eye_y - sy
                dist_sq = dx * dx + dy * dy
                conc = intensity * np.exp(-dist_sq / (2 * sigma * sigma))
                total += conc
            return total
        
        left_shadow = compute_intensity(left_eye_x, left_eye_y, shadow_sources)
        right_shadow = compute_intensity(right_eye_x, right_eye_y, shadow_sources)
        
        # Optional: Also consider light sources (flee from light = inject on bright side)
        if light_sources:
            left_light = compute_intensity(left_eye_x, left_eye_y, light_sources)
            right_light = compute_intensity(right_eye_x, right_eye_y, light_sources)
            # Light avoidance: inject on the BRIGHT side to turn AWAY
            # (opposite of shadow preference - inject on shadow side to turn TOWARD)
            left_shadow += left_light  # Light acts like shadow for injection
            right_shadow += right_light
        
        # Apply threshold
        if left_shadow < self.params.shadow_threshold and right_shadow < self.params.shadow_threshold:
            return {}
        
        # Compute injection currents
        # AOTU_L for left shadow/light → ipsilateral L DN → turn RIGHT
        # AOTU_R for right shadow/light → ipsilateral R DN → turn LEFT
        left_current = left_shadow * self.params.aotu_gain
        right_current = right_shadow * self.params.aotu_gain
        
        currents = {}
        
        # Inject to AOTU neurons
        for body_id in AOTU_LEFT:
            if body_id in self.body_to_idx:
                currents[body_id] = left_current
        
        for body_id in AOTU_RIGHT:
            if body_id in self.body_to_idx:
                currents[body_id] = right_current
        
        return currents
    
    def get_takeoff_currents(
        self,
        hunger_level: float,
        escape_loom: float = 0.0,
        is_walking: bool = True,
    ) -> Dict[int, float]:
        """
        ✅ PURE GRAPH TAKEOFF: Compute currents to flight-initiation DNs.
        
        SPIKE: DNb01/DNb02 are known flight initiation neurons (Namiki et al. 2018).
        When activated, they trigger transition from walking to flying.
        
        TAKEOFF GATES:
        1. HUNGER: When hunger is high (>0.6), inject to takeoff DNs
           - Biologically: Starved flies are more motivated to fly/search
           - Game effect: Forces takeoff when walking is too slow
        
        2. THREAT: Escape loom (LC4→DNp04) can also trigger takeoff
           - Giant Fiber pathway includes jump/takeoff
           - Complements the turn-away response
        
        Args:
            hunger_level: Current hunger (0.0=satiated, 1.0=starving)
            escape_loom: Escape loom signal (from threat)
            is_walking: Whether fly is currently walking (only inject if walking)
            
        Returns:
            Dict mapping body_id → injection current
        """
        if not is_walking:
            return {}
        
        if self.behavior_state == FlyBehaviorState.DEAD:
            return {}
        
        currents = {}
        
        # 1. HUNGER-driven takeoff
        hunger_drive = 0.0
        if hunger_level > self.params.takeoff_hunger_threshold:
            # Ramp up takeoff drive as hunger increases
            excess = hunger_level - self.params.takeoff_hunger_threshold
            hunger_drive = excess * self.params.takeoff_hunger_gain
        
        # 2. THREAT-driven takeoff (escape → jump/fly)
        threat_drive = 0.0
        if escape_loom > self.params.escape_loom_threshold:
            threat_drive = escape_loom * self.params.takeoff_threat_gain
        
        # Combine drives
        total_drive = hunger_drive + threat_drive
        
        if total_drive < 0.1:
            return {}
        
        # Inject bilaterally (symmetric for takeoff)
        for body_id in TAKEOFF_DN_LEFT:
            if body_id in self.body_to_idx:
                currents[body_id] = total_drive
        
        for body_id in TAKEOFF_DN_RIGHT:
            if body_id in self.body_to_idx:
                currents[body_id] = total_drive
        
        return currents
    
    def read_takeoff_dn_activity(self, V: np.ndarray, spikes: np.ndarray = None) -> float:
        """Read average activity of takeoff (flight-initiation) DNs.
        
        Uses spike count if spikes provided, otherwise falls back to membrane voltage.
        
        Note: V is reset to 0 after spiking, so reading V alone misses spiking neurons.
        Spike count is more reliable for detecting strong activation.
        """
        if not self.takeoff_dn_left_idx and not self.takeoff_dn_right_idx:
            return 0.0
        
        all_idx = self.takeoff_dn_left_idx + self.takeoff_dn_right_idx
        
        if spikes is not None:
            # Count spiking fraction (more reliable than V for high-current injection)
            spike_frac = float(np.mean(spikes[all_idx]))
            # Also include subthreshold V for neurons not spiking
            v_mean = float(np.mean(V[all_idx]))
            # Combine: spike_frac scaled to 1.0 max + normalized V
            return spike_frac + v_mean * 0.1  # Spikes dominate
        else:
            return float(np.mean(V[all_idx]))
    
    def should_takeoff(self, takeoff_dn_activity: float) -> bool:
        """Check if takeoff DN activity exceeds threshold for actual takeoff."""
        return takeoff_dn_activity > self.params.takeoff_dn_threshold
    
    def get_feeding_currents(
        self,
        contact_strength: float,
    ) -> Dict[int, float]:
        """
        Compute currents to inject for feeding behavior.
        
        Tarsal contact → sugar GRNs → GNG interneurons → proboscis MNs
        Hunger state modulates the gain of the entire pathway.
        """
        if contact_strength <= 0:
            return {}
        
        if self.behavior_state == FlyBehaviorState.DEAD:
            return {}
        
        sugar_current = contact_strength * self.params.sugar_gain * self.hunger.feeding_gain
        
        currents = {}
        
        for idx in self.tarsal_grn_idx:
            body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
            currents[body_id] = sugar_current
        
        for idx in self.bm_taste_idx:
            body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
            currents[body_id] = sugar_current * 0.8
        
        if contact_strength > 0.2:
            gng_current = sugar_current * 1.0  # Stronger GNG activation
            for idx in self.gng_interneuron_idx:
                body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
                currents[body_id] = gng_current
            
            # Proboscis MNs activate strongly when on fruit
            if contact_strength > 0.3 and self.behavior_state in [FlyBehaviorState.LANDED, FlyBehaviorState.FEEDING]:
                mn_current = sugar_current * 0.8  # Strong proboscis drive
                for idx in self.proboscis_mn_idx:
                    body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
                    currents[body_id] = mn_current
        
        if self.hunger.level > 0.5:
            npf_current = self.hunger.level * 2.0
            for idx in self.npf_idx:
                body_id = [b for b, i in self.body_to_idx.items() if i == idx][0]
                currents[body_id] = npf_current
        
        return currents
    
    def read_landing_dn_activity(self, V: np.ndarray) -> float:
        """Read average activity of landing DNs from membrane potentials."""
        if not self.landing_dn_left_idx and not self.landing_dn_right_idx:
            return 0.0
        
        all_idx = self.landing_dn_left_idx + self.landing_dn_right_idx
        return float(np.mean(V[all_idx]))
    
    def read_proboscis_mn_activity(self, V: np.ndarray) -> float:
        """Read average activity of proboscis motor neurons."""
        if not self.proboscis_mn_idx:
            return 0.0
        return float(np.mean(V[self.proboscis_mn_idx]))
    
    def update_behavior_state(
        self,
        landing_dn_activity: float,
        proboscis_mn_activity: float,
        loom_signal: float,
        contact_strength: float,
        takeoff_dn_activity: float = 0.0,
    ) -> Tuple[FlyBehaviorState, float, float, bool]:
        """
        Update behavioral state based on neural activity.
        
        DUAL-MODE LOCOMOTION:
        - WALKING: Ground locomotion (slow, precise)
        - FLYING: Aerial locomotion (fast, momentum)
        - Takeoff: WALKING → FLYING (hunger or threat)
        - Landing: FLYING → LANDING → LANDED → WALKING
        
        Returns:
            (new_state, thrust_modifier, landing_leg_extension, should_takeoff)
        """
        self.total_steps += 1
        should_takeoff = False
        
        if self.total_steps >= self.params.starve_time_steps and self.fed_count == 0:
            self.behavior_state = FlyBehaviorState.DEAD
            return FlyBehaviorState.DEAD, 0.0, 0.0, False
        
        self.hunger.update_from_time(1.0)
        
        thrust_modifier = 1.0
        leg_extension = 0.0
        
        # WALKING state - ground locomotion, can takeoff
        if self.behavior_state == FlyBehaviorState.WALKING:
            # Check for takeoff trigger (hunger or threat via DN activity)
            if takeoff_dn_activity > self.params.takeoff_dn_threshold:
                self.behavior_state = FlyBehaviorState.FLYING
                should_takeoff = True
        
        # FLYING state - aerial locomotion, can land
        elif self.behavior_state == FlyBehaviorState.FLYING:
            if landing_dn_activity > 0.3 and loom_signal > self.params.loom_threshold:
                self.behavior_state = FlyBehaviorState.LANDING
                self.landing_progress = 0
        
        elif self.behavior_state == FlyBehaviorState.LANDING:
            self.landing_progress += 1
            
            progress_ratio = min(1.0, self.landing_progress / self.params.landing_settle_time)
            thrust_modifier = 1.0 - progress_ratio * self.params.landing_thrust_reduction
            leg_extension = progress_ratio
            
            if contact_strength > 0.5:
                self.behavior_state = FlyBehaviorState.LANDED
                self.landing_progress = 0
            
            elif self.landing_progress > self.params.landing_settle_time * 2:
                # Failed landing - go back to flying (will try again)
                self.behavior_state = FlyBehaviorState.FLYING
        
        elif self.behavior_state == FlyBehaviorState.LANDED:
            thrust_modifier = 0.1
            leg_extension = 1.0
            
            # Check for feeding initiation - proboscis MN activity or GNG + contact
            # Lower threshold since activity propagates through graph
            if (proboscis_mn_activity > 0.1 or 
                (contact_strength > 0.5 and self.hunger.level > 0.5)):
                self.behavior_state = FlyBehaviorState.FEEDING
                self.feeding_progress = 0
            
            elif contact_strength < 0.1:
                # Lost contact - back to walking (not flying immediately)
                self.behavior_state = FlyBehaviorState.WALKING
        
        elif self.behavior_state == FlyBehaviorState.FEEDING:
            thrust_modifier = 0.0  # Completely stop
            leg_extension = 1.0
            self.feeding_progress += 1
            
            # Complete feeding bout
            if self.feeding_progress >= self.params.feeding_time:
                self.hunger.update_from_feeding(0.3)
                self.fed_count += 1
                self.behavior_state = FlyBehaviorState.LANDED
                self.feeding_progress = 0
            
            # Only exit if VERY far from fruit (allow some movement while feeding)
            elif contact_strength < 0.05:
                # Lost contact while feeding - back to walking
                self.behavior_state = FlyBehaviorState.WALKING
                self.feeding_progress = 0
        
        return self.behavior_state, thrust_modifier, leg_extension, should_takeoff
    
    def get_starvation_status(self) -> Tuple[float, bool]:
        """
        Get starvation status.
        
        Returns:
            (time_remaining_ratio, is_starving)
        """
        remaining = self.params.starve_time_steps - self.total_steps
        ratio = max(0, remaining / self.params.starve_time_steps)
        
        is_starving = self.total_steps > self.params.starve_time_steps * 0.8 and self.fed_count == 0
        
        return ratio, is_starving
    
    def get_state_summary(self) -> Dict:
        """Get summary of current state."""
        return {
            "behavior_state": self.behavior_state.value,
            "hunger_level": self.hunger.level,
            "feeding_gain": self.hunger.feeding_gain,
            "fed_count": self.fed_count,
            "total_steps": self.total_steps,
            "time_remaining_sec": (self.params.starve_time_steps - self.total_steps) * self.params.step_to_seconds,
            "is_dead": self.behavior_state == FlyBehaviorState.DEAD,
        }
