"""
Flight maze simulation with landing and feeding behaviors.

BEHAVIORAL CHAIN:
1. Fly starts HUNGRY (amplified feeding pathway)
2. Chemotaxis: bilateral odor → flight toward fruit (PURE GRAPH)
3. Landing: visual LOOM signal → landing DNs (DNp07/DNp10) → reduced thrust
4. Feeding: tarsal SUGAR contact → GRNs → proboscis MNs → hunger satisfied
5. Starvation: 5 minutes without feeding → DEATH

CRITICAL CONSTRAINTS:
- NO distance-based landing (loom signal only)
- NO auto-eat on contact (requires proboscis MN activation from graph)
- Pure-graph chemotaxis (bilateral odor injection, no bearing shortcuts)
"""

import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

try:
    from .graph_loader import MaleCNSGraph
    from .lif_sim import LIFSimulator, LIFParams
    from .olfaction import BilateralOlfactoryInjector, FRUIT_ESTER_BLEND, VINEGAR_BLEND
    from .flight import FlightDynamics, FlightParams, WalkParams, LocomotionMode
    from .maze import Maze, StimulusType
    from .landing_feeding import (
        LandingFeedingSystem, LandingFeedingParams,
        FlyBehaviorState, HungerState,
    )
except ImportError:
    from graph_loader import MaleCNSGraph
    from lif_sim import LIFSimulator, LIFParams
    from olfaction import BilateralOlfactoryInjector, FRUIT_ESTER_BLEND, VINEGAR_BLEND
    from flight import FlightDynamics, FlightParams, WalkParams, LocomotionMode
    from maze import Maze, StimulusType
    from landing_feeding import (
        LandingFeedingSystem, LandingFeedingParams,
        FlyBehaviorState, HungerState,
    )


class GameState(Enum):
    RUNNING = "running"
    WON = "won"       # Fed before starving (or reached jar)
    TIMEOUT = "timeout"
    STARVED = "starved"  # Died from hunger
    ZAPPED = "zapped"    # Killed by fly zapper (environment hazard)


@dataclass
class FeedingOdorSource:
    """Odor source adapter for stimuli."""
    x: float
    y: float
    intensity: float
    sigma: float
    is_fruit: bool = True  # Can land/feed on this
    is_aversive: bool = False  # Vinegar/repellent (uses inhibitory LH pathway)
    
    def concentration(self, px: float, py: float) -> float:
        d2 = (px - self.x) ** 2 + (py - self.y) ** 2
        return self.intensity * np.exp(-d2 / (2 * self.sigma ** 2))


@dataclass
class FeedingMazeState:
    """State of a feeding maze run."""
    step: int = 0
    game_state: GameState = GameState.RUNNING
    win_step: Optional[int] = None
    
    # Behavior tracking
    first_landing_step: Optional[int] = None
    first_feeding_step: Optional[int] = None
    first_takeoff_step: Optional[int] = None  # DUAL-MODE: First takeoff
    total_feeds: int = 0
    total_takeoffs: int = 0  # DUAL-MODE: Takeoff count
    
    # History
    thrusts: List[float] = None
    turns: List[float] = None
    behavior_states: List[str] = None
    locomotion_modes: List[str] = None  # DUAL-MODE: walk/fly history
    loom_signals: List[float] = None
    contact_strengths: List[float] = None
    hunger_levels: List[float] = None
    
    # Escape tracking (SPIKE: LC4→DNp04 pure graph escape)
    escape_looms: List[float] = None
    
    # Scototaxis tracking (SPIKE: AOTU→DNa02/DNa03 pure graph shadow preference)
    shadow_intensities_l: List[float] = None
    shadow_intensities_r: List[float] = None
    
    # Takeoff tracking (SPIKE: DNb01/DNb02 flight initiation)
    takeoff_dn_activities: List[float] = None
    
    def __post_init__(self):
        if self.thrusts is None:
            self.thrusts = []
            self.turns = []
            self.behavior_states = []
            self.locomotion_modes = []
            self.loom_signals = []
            self.contact_strengths = []
            self.hunger_levels = []
            self.escape_looms = []
            self.shadow_intensities_l = []
            self.shadow_intensities_r = []
            self.takeoff_dn_activities = []


class FeedingMazeSimulator:
    """
    Flight maze simulation with landing and feeding.
    
    FLYING + LANDING + FEEDING:
    - Flight chemotaxis toward fruit (pure graph)
    - Visual loom triggers landing DNs
    - Tarsal sugar contact triggers feeding
    - Hunger modulates feeding pathway gain
    - 5-minute starvation timer
    
    GAIN PARAMETERS (for sweep experiments):
    - feeding_gain: Affects sugar→proboscis (post-contact)
    - olfactory_gain: Affects hunger→approach (pre-contact)
    """
    
    def __init__(
        self,
        graph: MaleCNSGraph,
        maze: Maze,
        seed: int = 42,
        odor_current: float = 5.0,
        starve_time_steps: int = 3000,  # 5 min at 0.1s/step
        feeding_gain: float = 2.0,      # Sugar→proboscis pathway
        olfactory_gain: float = 1.0,    # Hunger→approach motivation
    ):
        self.graph = graph
        self.maze = maze
        self.seed = seed
        self.odor_current = odor_current
        self.rng = np.random.default_rng(seed)
        
        # LIF simulator
        self.params = LIFParams()
        self.lif = LIFSimulator(
            adjacency=graph.adjacency,
            body_to_idx=graph.body_to_idx,
            idx_to_body=graph.idx_to_body,
            params=self.params,
            seed=seed,
        )
        self.lif.set_motor_neurons(graph.dn_bodies, graph.mn_bodies, graph)
        
        # Store gains for olfactory modulation
        self._feeding_gain = feeding_gain
        self._olfactory_gain = olfactory_gain
        
        # Bilateral olfactory injector
        self.olfactory = BilateralOlfactoryInjector(
            graph.annotations, graph.body_to_idx
        )
        
        # Landing and feeding system with configurable gains
        lf_params = LandingFeedingParams(starve_time_steps=starve_time_steps)
        self.landing_feeding = LandingFeedingSystem(
            graph.body_to_idx, lf_params,
            feeding_gain=feeding_gain,
            olfactory_gain=olfactory_gain,
        )
        
        # Dual-mode locomotion: WALKING vs FLYING
        self.flight_params = FlightParams(
            max_speed=4.0,
            max_angular_speed=0.25,
            drag=0.03,
            angular_drag=0.1,
            thrust_gain=0.15,
            turn_gain=0.08,
        )
        self.walk_params = WalkParams(
            max_speed=1.2,           # Much slower than flight
            max_angular_speed=0.15,  # Tighter turns
            drag=0.15,               # Higher friction
            angular_drag=0.2,
            thrust_gain=0.08,
            turn_gain=0.06,
        )
        self.flight = FlightDynamics(
            flight_params=self.flight_params,
            walk_params=self.walk_params,
            initial_mode=LocomotionMode.WALKING,  # Start walking
        )
        
        # Build odor/fruit/aversive/threat/shadow/light/zapper sources
        (self.odor_sources, self.fruit_sources, self.aversive_sources, 
         self.threat_sources, self.shadow_sources, self.light_sources,
         self.zapper_sources) = self._build_sources()
        
        # State
        self.state = FeedingMazeState()
        self.reset()
    
    def _build_sources(self) -> Tuple[List[FeedingOdorSource], List[FeedingOdorSource], List[FeedingOdorSource], List[FeedingOdorSource], List[Tuple[float,float,float,float]], List[Tuple[float,float,float,float]], List[Tuple[float,float,float]]]:
        """Convert maze stimuli to odor sources, fruit targets, aversive sources, threat sources, shadow zones, light sources, and zappers.
        
        Returns:
            (odor_sources, fruit_sources, aversive_sources, threat_sources, shadow_sources, light_sources, zapper_sources)
            
        shadow_sources and light_sources are tuples: (x, y, intensity, sigma) for scototaxis
        zapper_sources are tuples: (x, y, radius) for lethal hazards
        """
        odor_sources = []      # Attractive odor sources
        fruit_sources = []     # Landable fruit targets
        aversive_sources = []  # Aversive sources (vinegar)
        shadow_sources = []    # Shadow zones for scototaxis (AOTU injection)
        light_sources = []     # Light sources for light avoidance (AOTU injection)
        zapper_sources = []    # Lethal fly zappers (environment hazard)
        # threat_sources built separately below
        
        for stim in self.maze.stimuli:
            if stim.type == StimulusType.FRUIT:
                source = FeedingOdorSource(
                    x=stim.x, y=stim.y,
                    intensity=stim.intensity,
                    sigma=stim.sigma,
                    is_fruit=True,  # Landable
                    is_aversive=False,
                )
                odor_sources.append(source)
                fruit_sources.append(source)
            elif stim.type == StimulusType.CRUMB:
                # CRUMB: Trail breadcrumb - attracts but NOT landable
                odor_sources.append(FeedingOdorSource(
                    x=stim.x, y=stim.y,
                    intensity=stim.intensity,
                    sigma=stim.sigma,
                    is_fruit=False,  # NOT landable - just a scent trail
                    is_aversive=False,
                ))
            elif stim.type == StimulusType.JAR_BAIT:
                odor_sources.append(FeedingOdorSource(
                    x=stim.x, y=stim.y,
                    intensity=stim.intensity * 0.8,
                    sigma=stim.sigma,
                    is_fruit=False,
                    is_aversive=False,
                ))
            elif stim.type == StimulusType.EXIT:
                # EXIT: Near-field attractive odor ("smell of freedom")
                # Uses SMALL sigma so only attracts when fly is close (final room)
                # NOT a landable fruit - just odor pull toward exit
                odor_sources.append(FeedingOdorSource(
                    x=stim.x, y=stim.y,
                    intensity=stim.intensity,
                    sigma=stim.sigma,  # Keep small for near-field only
                    is_fruit=False,    # Can't land on exit
                    is_aversive=False,
                ))
            elif stim.type == StimulusType.VINEGAR:
                # PURE GRAPH AVERSION: Use inhibitory LH pathway (olfactory)
                aversive_sources.append(FeedingOdorSource(
                    x=stim.x, y=stim.y,
                    intensity=stim.intensity,
                    sigma=stim.sigma,
                    is_fruit=False,
                    is_aversive=True,
                ))
            elif stim.type == StimulusType.LIGHT:
                # SCOTOTAXIS: Light source triggers AOTU injection (flee from light)
                # ⚠️ DEMOTING OLD STUB: No longer use olfactory pathway for light
                # ✅ NEW: Use AOTU→DNa02/DNa03 (pure graph negative phototaxis)
                light_sources.append((stim.x, stim.y, stim.intensity, stim.sigma))
            elif stim.type == StimulusType.SHADOW:
                # SCOTOTAXIS: Shadow zone triggers AOTU injection (turn toward shadow)
                # ✅ NEW: Use AOTU→DNa02/DNa03 (pure graph shadow preference)
                shadow_sources.append((stim.x, stim.y, stim.intensity, stim.sigma))
            elif stim.type == StimulusType.ZAPPER:
                # ☠️ LETHAL HAZARD: Contact kills fly
                # sigma = zap radius (fly dies if within this distance)
                zapper_sources.append((stim.x, stim.y, stim.sigma))
            # THREAT is handled separately (not an odor source)
        
        # Build threat sources for escape loom
        threat_sources = []
        for stim in self.maze.stimuli:
            if stim.type == StimulusType.THREAT:
                threat_sources.append(FeedingOdorSource(
                    x=stim.x, y=stim.y,
                    intensity=stim.intensity,
                    sigma=stim.sigma,
                    is_fruit=False,
                    is_aversive=False,
                ))
        
        return odor_sources, fruit_sources, aversive_sources, threat_sources, shadow_sources, light_sources, zapper_sources
    
    def reset(self, new_seed: Optional[int] = None, start_flying: bool = False):
        """Reset simulation to initial state.
        
        Args:
            new_seed: Random seed for reproducibility
            start_flying: If True, start in FLYING mode; else start WALKING
        """
        if new_seed is not None:
            self.seed = new_seed
            self.rng = np.random.default_rng(new_seed)
        
        self.lif.reset(self.seed)
        self.landing_feeding.reset(start_flying=start_flying)
        
        # Initialize locomotion with appropriate speed
        initial_mode = LocomotionMode.FLYING if start_flying else LocomotionMode.WALKING
        initial_speed = 1.0 if start_flying else 0.5  # Slower start for walking
        self.flight.reset(
            x=self.maze.fly_start_x,
            y=self.maze.fly_start_y,
            theta=self.maze.fly_start_theta,
            initial_speed=initial_speed,
            initial_mode=initial_mode,
        )
        
        self.state = FeedingMazeState()
    
    @property
    def x(self) -> float:
        return self.flight.state.x
    
    @property
    def y(self) -> float:
        return self.flight.state.y
    
    @property
    def theta(self) -> float:
        return self.flight.state.theta
    
    @property
    def vx(self) -> float:
        return self.flight.state.vx
    
    @property
    def vy(self) -> float:
        return self.flight.state.vy
    
    @property
    def path_x(self) -> List[float]:
        return self.flight.path_x
    
    @property
    def path_y(self) -> List[float]:
        return self.flight.path_y
    
    def _find_nearest_fruit(self) -> Optional[Tuple[float, float, float]]:
        """Find nearest fruit source. Returns (x, y, distance) or None."""
        if not self.fruit_sources:
            return None
        
        min_dist = float('inf')
        nearest = None
        
        for fruit in self.fruit_sources:
            dx = self.x - fruit.x
            dy = self.y - fruit.y
            dist = np.sqrt(dx * dx + dy * dy)
            if dist < min_dist:
                min_dist = dist
                nearest = (fruit.x, fruit.y, dist)
        
        return nearest
    
    def step(self) -> GameState:
        """
        Run one simulation step with landing/feeding.
        
        ORDER OF OPERATIONS:
        1. Compute loom signal and tarsal contact (nearest fruit)
        2. Inject landing/feeding currents
        3. Inject olfactory currents (chemotaxis)
        4. LIF step
        5. Read landing DN and proboscis MN activity
        6. Update behavior state
        7. Apply flight dynamics (modified by behavior)
        8. Handle collisions and win conditions
        """
        if self.state.game_state != GameState.RUNNING:
            return self.state.game_state
        
        # Find nearest fruit for loom/contact computation
        nearest_fruit = self._find_nearest_fruit()
        
        loom_signal = 0.0
        contact_strength = 0.0
        
        if nearest_fruit:
            fruit_x, fruit_y, fruit_dist = nearest_fruit
            
            # Compute visual loom signal (NOT a distance threshold!)
            loom_signal, _ = self.landing_feeding.compute_loom_signal(
                fly_x=self.x, fly_y=self.y,
                fly_vx=self.vx, fly_vy=self.vy,
                fruit_x=fruit_x, fruit_y=fruit_y,
            )
            
            # Compute tarsal contact (physical overlap)
            contact_strength = self.landing_feeding.compute_tarsal_contact(
                fly_x=self.x, fly_y=self.y,
                fruit_x=fruit_x, fruit_y=fruit_y,
            )
        
        # Build external currents
        currents = {}
        
        # 1. Landing currents (loom → landing DNs)
        landing_currents = self.landing_feeding.get_landing_currents(
            loom_signal=loom_signal,
            fly_theta=self.theta,
        )
        currents.update(landing_currents)
        
        # 2. Feeding currents (sugar → GRNs → proboscis MNs)
        feeding_currents = self.landing_feeding.get_feeding_currents(
            contact_strength=contact_strength,
        )
        currents.update(feeding_currents)
        
        # 2b. ESCAPE LOOM: Threat → LC4 → DNp04 (PURE GRAPH ESCAPE)
        # SPIKE FINDING: LC4→DNp04 produces +829% escape DN spike increase
        escape_loom = 0.0
        threat_angle = None
        if self.threat_sources:
            max_loom_threat = None
            for threat in self.threat_sources:
                threat_loom, _ = self.landing_feeding.compute_escape_loom(
                    fly_x=self.x, fly_y=self.y,
                    fly_vx=self.vx, fly_vy=self.vy,
                    threat_x=threat.x, threat_y=threat.y,
                    threat_radius=threat.intensity * 50.0,  # Scale by intensity
                )
                if threat_loom > escape_loom:
                    escape_loom = threat_loom
                    max_loom_threat = threat
            
            # Compute threat angle for bilateral LC4 injection
            if max_loom_threat and escape_loom > 0:
                dx = max_loom_threat.x - self.x
                dy = max_loom_threat.y - self.y
                threat_world_angle = np.arctan2(dy, dx)
                threat_angle = threat_world_angle - self.theta  # Relative to fly heading
            
            # Inject to LC4 neurons (visual layer, with bilateral asymmetry)
            escape_currents = self.landing_feeding.get_escape_currents(
                escape_loom=escape_loom,
                threat_angle=threat_angle,
            )
            for body_id, current in escape_currents.items():
                currents[body_id] = currents.get(body_id, 0) + current
        
        # 3. Olfactory currents (chemotaxis - PURE GRAPH, no bearing bias!)
        # Apply hunger→olfactory gain (biologically: starved flies are more motivated to seek food)
        olf_gain = self.landing_feeding.hunger.olfactory_gain
        
        # 3a. ATTRACTIVE currents (fruit, jar bait) → excitatory LH → turn toward
        olf_currents = self.olfactory.get_bilateral_odor_currents(
            fly_x=self.x, fly_y=self.y, fly_theta=self.theta,
            odor_sources=self.odor_sources,
            odor_blend=FRUIT_ESTER_BLEND,
            base_current=self.odor_current * olf_gain,  # Hunger boosts olfactory drive
        )
        for body_id, current in olf_currents.items():
            currents[body_id] = currents.get(body_id, 0) + current
        
        # 3b. AVERSIVE currents (vinegar) → inhibitory LH → turn away
        # PURE GRAPH aversion — no external turn-away vector
        if self.aversive_sources:
            aversive_currents = self.olfactory.get_bilateral_aversive_currents(
                fly_x=self.x, fly_y=self.y, fly_theta=self.theta,
                odor_sources=self.aversive_sources,
                odor_blend=VINEGAR_BLEND,
                base_current=self.odor_current,  # No hunger boost for aversion
            )
            for body_id, current in aversive_currents.items():
                currents[body_id] = currents.get(body_id, 0) + current
        
        # 3c. SCOTOTAXIS currents (shadow/light) → AOTU → turn toward shadow / away from light
        # ✅ PURE GRAPH via AOTU→DNa02/DNa03 (ipsilateral activation = negative phototaxis)
        # SPIKE FINDING: AOTU_L injection → L DN → turn RIGHT → TOWARD shadow on L
        shadow_l = 0.0
        shadow_r = 0.0
        if self.shadow_sources or self.light_sources:
            scoto_currents = self.landing_feeding.get_scototaxis_currents(
                fly_x=self.x, fly_y=self.y, fly_theta=self.theta,
                shadow_sources=self.shadow_sources,
                light_sources=self.light_sources,
            )
            for body_id, current in scoto_currents.items():
                currents[body_id] = currents.get(body_id, 0) + current
            
            # Track shadow intensities for metrics (quick compute)
            eye_offset = self.landing_feeding.params.eye_offset
            sin_theta = np.sin(self.theta)
            cos_theta = np.cos(self.theta)
            left_eye_x = self.x - eye_offset * sin_theta
            left_eye_y = self.y + eye_offset * cos_theta
            right_eye_x = self.x + eye_offset * sin_theta
            right_eye_y = self.y - eye_offset * cos_theta
            
            for sx, sy, intensity, sigma in self.shadow_sources:
                d2_l = (left_eye_x - sx)**2 + (left_eye_y - sy)**2
                d2_r = (right_eye_x - sx)**2 + (right_eye_y - sy)**2
                shadow_l += intensity * np.exp(-d2_l / (2 * sigma * sigma))
                shadow_r += intensity * np.exp(-d2_r / (2 * sigma * sigma))
        
        # 3d. TAKEOFF currents (hunger/threat → flight-initiation DNs)
        # ✅ PURE GRAPH: DNb01/DNb02 are known flight initiation neurons
        # SPIKE: Hunger or threat can trigger takeoff from WALKING mode
        takeoff_currents = self.landing_feeding.get_takeoff_currents(
            hunger_level=self.landing_feeding.hunger.level,
            escape_loom=escape_loom,
            is_walking=self.flight.is_walking,
        )
        for body_id, current in takeoff_currents.items():
            currents[body_id] = currents.get(body_id, 0) + current
        
        # Set currents and run LIF
        self.lif.set_external_current(currents)
        spikes, _, _ = self.lif.step()
        
        # Read neural activity
        landing_dn_activity = self.landing_feeding.read_landing_dn_activity(self.lif.V)
        proboscis_mn_activity = self.landing_feeding.read_proboscis_mn_activity(self.lif.V)
        takeoff_dn_activity = self.landing_feeding.read_takeoff_dn_activity(self.lif.V, spikes)
        
        # Update behavior state (landing/feeding/takeoff progress)
        behavior_state, thrust_modifier, leg_extension, should_takeoff = self.landing_feeding.update_behavior_state(
            landing_dn_activity=landing_dn_activity,
            proboscis_mn_activity=proboscis_mn_activity,
            loom_signal=loom_signal,
            contact_strength=contact_strength,
            takeoff_dn_activity=takeoff_dn_activity,
        )
        
        # Handle locomotion mode transitions
        if should_takeoff and self.flight.is_walking:
            self.flight.takeoff()
            self.state.total_takeoffs += 1
            if self.state.first_takeoff_step is None:
                self.state.first_takeoff_step = self.state.step
        
        # Landing transitions to walking mode
        if behavior_state == FlyBehaviorState.LANDED and self.flight.is_flying:
            self.flight.land()
        
        # Check for starvation death
        if behavior_state == FlyBehaviorState.DEAD:
            self.state.game_state = GameState.STARVED
            return GameState.STARVED
        
        # Track first landing/feeding
        if behavior_state == FlyBehaviorState.LANDED and self.state.first_landing_step is None:
            self.state.first_landing_step = self.state.step
        if self.landing_feeding.fed_count > self.state.total_feeds:
            self.state.total_feeds = self.landing_feeding.fed_count
            if self.state.first_feeding_step is None:
                self.state.first_feeding_step = self.state.step
        
        # Compute flight motor output
        thrust, turn = self.lif.compute_flight_motor_output()
        
        # Apply behavior modifications
        thrust *= thrust_modifier
        
        # When landed/feeding, apply extra drag to stay on fruit
        if behavior_state in [FlyBehaviorState.LANDED, FlyBehaviorState.FEEDING]:
            # Increase drag significantly when on ground/fruit
            self.flight.state.vx *= 0.5  # Strong deceleration
            self.flight.state.vy *= 0.5
        
        # Apply physical effects (wind)
        phys = self.maze.get_physical_effects_at(self.x, self.y)
        thrust += phys["thrust_push"]
        turn += phys["lateral_push"] * 0.1
        
        # Record state
        self.state.thrusts.append(thrust)
        self.state.turns.append(turn)
        self.state.behavior_states.append(behavior_state.value)
        self.state.locomotion_modes.append(self.flight.mode.value)  # Track walk/fly
        self.state.loom_signals.append(loom_signal)
        self.state.contact_strengths.append(contact_strength)
        self.state.hunger_levels.append(self.landing_feeding.hunger.level)
        self.state.escape_looms.append(escape_loom)  # Track escape loom signal
        self.state.shadow_intensities_l.append(shadow_l)  # Track scototaxis
        self.state.shadow_intensities_r.append(shadow_r)
        self.state.takeoff_dn_activities.append(takeoff_dn_activity)  # Track takeoff drive
        
        # Store old position
        old_x, old_y = self.x, self.y
        
        # Flight dynamics step
        new_x, new_y = self.flight.step(thrust, turn)
        
        # Check jar win (if jar exists)
        if self.maze.jar and self.maze.check_win(old_x, old_y, new_x, new_y):
            self.state.game_state = GameState.WON
            self.state.win_step = self.state.step
            return GameState.WON
        
        # Wall collision
        final_x, final_y, edge = self.maze.check_wall_collision(
            old_x, old_y, new_x, new_y
        )
        if edge:
            if edge == "left":
                normal = 0
            elif edge == "right":
                normal = np.pi
            elif edge == "bottom":
                normal = np.pi / 2
            else:
                normal = -np.pi / 2
            self.flight.apply_collision(final_x, final_y, normal)
        
        # Jar collision
        if self.maze.jar:
            jar_x, jar_y, blocked = self.maze.check_jar_collision(
                old_x, old_y, self.x, self.y
            )
            if blocked:
                angle_from_jar = np.arctan2(jar_y - self.maze.jar.y, jar_x - self.maze.jar.x)
                self.flight.apply_collision(jar_x, jar_y, angle_from_jar)
        
        # Arena boundary
        final_x, final_y, hit = self.maze.check_boundary(self.x, self.y)
        if hit:
            if self.x <= 5:
                normal = 0
            elif self.x >= self.maze.width - 5:
                normal = np.pi
            elif self.y <= 5:
                normal = np.pi / 2
            else:
                normal = -np.pi / 2
            self.flight.apply_collision(final_x, final_y, normal)
        
        # ☠️ ZAPPER CHECK: Contact with zapper kills fly
        for zx, zy, zap_radius in self.zapper_sources:
            dist = np.sqrt((self.x - zx)**2 + (self.y - zy)**2)
            if dist <= zap_radius:
                self.state.game_state = GameState.ZAPPED
                return GameState.ZAPPED
        
        self.state.step += 1
        
        # Check timeout
        if self.state.step >= self.maze.time_limit:
            # If we fed at least once, that's a survival win
            if self.state.total_feeds > 0:
                self.state.game_state = GameState.WON
            else:
                self.state.game_state = GameState.TIMEOUT
            return self.state.game_state
        
        return GameState.RUNNING
    
    def run_until_done(self, max_steps: Optional[int] = None) -> GameState:
        """Run until win, timeout, or starvation."""
        max_steps = max_steps or self.maze.time_limit
        
        while self.state.step < max_steps:
            result = self.step()
            if result != GameState.RUNNING:
                return result
        
        # Final check
        if self.state.total_feeds > 0:
            self.state.game_state = GameState.WON
        else:
            self.state.game_state = GameState.TIMEOUT
        return self.state.game_state
    
    def get_metrics(self) -> Dict:
        """Get simulation metrics."""
        path = np.array([self.path_x, self.path_y]).T
        
        # Path length
        if len(path) > 1:
            path_length = float(np.sum(np.sqrt(
                np.diff(path[:, 0]) ** 2 + np.diff(path[:, 1]) ** 2
            )))
        else:
            path_length = 0.0
        
        metrics = {
            "total_steps": self.state.step,
            "final_state": self.state.game_state.value,
            "path_length": path_length,
            "mode": "DUAL (WALK + FLIGHT)",
        }
        
        # Landing/feeding metrics
        metrics["first_landing_step"] = self.state.first_landing_step
        metrics["first_feeding_step"] = self.state.first_feeding_step
        metrics["first_takeoff_step"] = self.state.first_takeoff_step
        metrics["total_feeds"] = self.state.total_feeds
        metrics["total_takeoffs"] = self.state.total_takeoffs
        metrics["final_hunger"] = self.landing_feeding.hunger.level
        
        # Behavior breakdown
        if self.state.behavior_states:
            from collections import Counter
            state_counts = Counter(self.state.behavior_states)
            total = len(self.state.behavior_states)
            metrics["time_walking"] = state_counts.get("walking", 0) / total
            metrics["time_flying"] = state_counts.get("flying", 0) / total
            metrics["time_landing"] = state_counts.get("landing", 0) / total
            metrics["time_landed"] = state_counts.get("landed", 0) / total
            metrics["time_feeding"] = state_counts.get("feeding", 0) / total
        
        # Locomotion mode breakdown
        if self.state.locomotion_modes:
            mode_counts = Counter(self.state.locomotion_modes)
            total = len(self.state.locomotion_modes)
            metrics["mode_walking_ratio"] = mode_counts.get("walking", 0) / total
            metrics["mode_flying_ratio"] = mode_counts.get("flying", 0) / total
        
        # Speed metrics
        if len(self.flight.path_x) > 1:
            speeds = []
            for i in range(1, len(self.flight.path_x)):
                dx = self.flight.path_x[i] - self.flight.path_x[i-1]
                dy = self.flight.path_y[i] - self.flight.path_y[i-1]
                speeds.append(np.sqrt(dx**2 + dy**2))
            metrics["mean_speed"] = float(np.mean(speeds))
            metrics["max_speed"] = float(np.max(speeds))
        
        # Time-based (step_to_seconds = 0.1)
        step_to_sec = self.landing_feeding.params.step_to_seconds
        metrics["time_to_first_land_sec"] = (
            self.state.first_landing_step * step_to_sec 
            if self.state.first_landing_step else None
        )
        metrics["time_to_first_feed_sec"] = (
            self.state.first_feeding_step * step_to_sec
            if self.state.first_feeding_step else None
        )
        metrics["total_time_sec"] = self.state.step * step_to_sec
        
        return metrics


def create_feeding_level() -> Maze:
    """
    Create a level optimized for landing and feeding demo.
    
    Simple arena with fruit - no jar, focus on landing/feeding behavior.
    """
    maze = Maze(
        width=500,
        height=300,
        name="Feeding Demo",
        time_limit=4000,  # Long enough to show feeding behavior
    )
    
    # Fly starts on left, hungry
    maze.fly_start_x = 80
    maze.fly_start_y = 150
    maze.fly_start_theta = 0  # Facing right
    
    # Simple walls to create corridor
    maze.add_wall(0, 240, 200, 60)    # Top-left
    maze.add_wall(0, 0, 200, 60)      # Bottom-left
    
    # Multiple fruit for landing/feeding targets
    # Closest fruit - easy landing target
    maze.add_stimulus(StimulusType.FRUIT, 200, 150, intensity=1.0, sigma=60)
    
    # Further fruits
    maze.add_stimulus(StimulusType.FRUIT, 350, 150, intensity=1.2, sigma=70)
    
    return maze


def create_survival_level() -> Maze:
    """
    Create a level where the fly must feed to survive.
    
    Fruit is moderately far - tests chemotaxis + landing + feeding chain.
    SURVIVAL POSSIBLE with good chemotaxis.
    """
    maze = Maze(
        width=600,
        height=300,
        name="Survival Challenge",
        time_limit=5000,
    )
    
    maze.fly_start_x = 60
    maze.fly_start_y = 150
    maze.fly_start_theta = 0
    
    # Walls create a winding path
    maze.add_wall(0, 220, 250, 80)
    maze.add_wall(0, 0, 250, 80)
    maze.add_wall(300, 120, 100, 180)  # Obstacle
    
    # Fruit at the end - must reach in time
    maze.add_stimulus(StimulusType.FRUIT, 520, 150, intensity=1.5, sigma=80)
    
    return maze


def create_starvation_level() -> Maze:
    """
    Create a HARD level where starvation is likely.
    
    Fruit is very far with weak odor signal. Only strong/lucky chemotaxis survives.
    This level is designed to show DEATH from starvation.
    """
    maze = Maze(
        width=800,
        height=400,
        name="Starvation Gauntlet",
        time_limit=4000,  # Matches 5-min starve at 3000 steps
    )
    
    # Fly starts in corner, fruit in opposite corner
    maze.fly_start_x = 50
    maze.fly_start_y = 350
    maze.fly_start_theta = -0.5  # Pointing slightly down-right
    
    # Maze walls create a long winding path
    maze.add_wall(0, 280, 300, 120)     # Top-left block
    maze.add_wall(150, 100, 200, 80)    # Middle-left block
    maze.add_wall(400, 200, 200, 200)   # Middle-right block
    maze.add_wall(500, 0, 150, 100)     # Bottom-right block
    
    # Single weak fruit in far corner - hard to find
    # Weak intensity + small sigma = hard to detect until close
    maze.add_stimulus(StimulusType.FRUIT, 720, 50, intensity=0.6, sigma=40)
    
    return maze


def create_easy_level() -> Maze:
    """
    Create an EASY level where survival is almost guaranteed.
    
    Fruit is close with strong odor - for comparison with hard level.
    """
    maze = Maze(
        width=400,
        height=250,
        name="Easy Feeding",
        time_limit=4000,
    )
    
    maze.fly_start_x = 80
    maze.fly_start_y = 125
    maze.fly_start_theta = 0
    
    # No obstacles
    # Strong fruit right in front
    maze.add_stimulus(StimulusType.FRUIT, 200, 125, intensity=1.5, sigma=80)
    maze.add_stimulus(StimulusType.FRUIT, 320, 125, intensity=1.2, sigma=70)
    
    return maze
