"""
Flight maze simulation using pure-graph MaleCNS chemotaxis.

FLYING, NOT WALKING - Uses momentum-based flight dynamics.

CRITICAL: NO external turn bias. All chemotaxis emerges from:
1. Bilateral odor sensing at antenna positions
2. Asymmetric current injection to excitatory LH neurons
3. Flight DN + olfactory DN motor readout
"""

import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json

from .graph_loader import MaleCNSGraph
from .lif_sim import LIFSimulator, LIFParams
from .olfaction import BilateralOlfactoryInjector, FRUIT_ESTER_BLEND
from .flight import FlightDynamics, FlightParams, FlightState
from .maze import Maze, StimulusType, create_herding_level


class GameState(Enum):
    RUNNING = "running"
    WON = "won"
    TIMEOUT = "timeout"


@dataclass
class FlightOdorSource:
    """Adapter for maze stimuli as odor sources."""
    x: float
    y: float
    intensity: float
    sigma: float
    
    def concentration(self, px: float, py: float) -> float:
        d2 = (px - self.x) ** 2 + (py - self.y) ** 2
        return self.intensity * np.exp(-d2 / (2 * self.sigma ** 2))


@dataclass 
class FlightMazeState:
    """State of a flight maze run."""
    step: int = 0
    game_state: GameState = GameState.RUNNING
    win_step: Optional[int] = None
    
    # Flight state is managed by FlightDynamics
    thrusts: List[float] = None
    turns: List[float] = None
    
    def __post_init__(self):
        if self.thrusts is None:
            self.thrusts = []
            self.turns = []


class FlightMazeSimulator:
    """
    Flight maze simulation with pure-graph chemotaxis.
    
    FLYING, NOT WALKING:
    - Momentum-based movement
    - Higher speeds
    - Flight-specific DN motor readout
    - Yaw control via differential wing activity
    """
    
    def __init__(
        self,
        graph: MaleCNSGraph,
        maze: Maze,
        seed: int = 42,
        odor_current: float = 5.0,
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
        
        # Bilateral olfactory injector
        self.olfactory = BilateralOlfactoryInjector(
            graph.annotations, graph.body_to_idx
        )
        
        # Flight dynamics
        self.flight_params = FlightParams(
            max_speed=4.0,
            max_angular_speed=0.25,
            drag=0.03,
            angular_drag=0.1,
            thrust_gain=0.15,
            turn_gain=0.08,
        )
        self.flight = FlightDynamics(self.flight_params)
        
        # Build odor sources from maze stimuli
        self.odor_sources = self._build_odor_sources()
        
        # State
        self.state = FlightMazeState()
        self.reset()
    
    def _build_odor_sources(self) -> List[FlightOdorSource]:
        """Convert maze stimuli to odor sources."""
        sources = []
        
        for stim in self.maze.stimuli:
            if stim.type in [StimulusType.FRUIT, StimulusType.JAR_BAIT]:
                sources.append(FlightOdorSource(
                    x=stim.x,
                    y=stim.y,
                    intensity=stim.intensity,
                    sigma=stim.sigma,
                ))
            elif stim.type == StimulusType.LIGHT:
                sources.append(FlightOdorSource(
                    x=stim.x,
                    y=stim.y,
                    intensity=stim.intensity * 0.3,
                    sigma=stim.sigma,
                ))
        
        return sources
    
    def reset(self, new_seed: Optional[int] = None):
        """Reset simulation to initial state."""
        if new_seed is not None:
            self.seed = new_seed
            self.rng = np.random.default_rng(new_seed)
        
        self.lif.reset(self.seed)
        
        # Initialize flight with small forward velocity
        self.flight.reset(
            x=self.maze.fly_start_x,
            y=self.maze.fly_start_y,
            theta=self.maze.fly_start_theta,
            initial_speed=1.0,  # Start with some momentum
        )
        
        self.state = FlightMazeState()
    
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
    def path_x(self) -> List[float]:
        return self.flight.path_x
    
    @property
    def path_y(self) -> List[float]:
        return self.flight.path_y
    
    def step(self) -> GameState:
        """
        Run one simulation step with FLIGHT dynamics.
        
        CRITICAL: Turn emerges from pure graph dynamics, not external bias.
        """
        if self.state.game_state != GameState.RUNNING:
            return self.state.game_state
        
        # Get bilateral odor currents (NO external turn bias!)
        currents = self.olfactory.get_bilateral_odor_currents(
            fly_x=self.x,
            fly_y=self.y,
            fly_theta=self.theta,
            odor_sources=self.odor_sources,
            odor_blend=FRUIT_ESTER_BLEND,
            base_current=self.odor_current,
        )
        self.lif.set_external_current(currents)
        
        # LIF step
        spikes, _, _ = self.lif.step()
        
        # Use FLIGHT motor output (uses flight DNs + olfactory DNs)
        thrust, turn = self.lif.compute_flight_motor_output()
        
        # Apply physical effects (wind only)
        phys = self.maze.get_physical_effects_at(self.x, self.y)
        thrust += phys["thrust_push"]
        turn += phys["lateral_push"] * 0.1
        
        # Record
        self.state.thrusts.append(thrust)
        self.state.turns.append(turn)
        
        # Store old position for collision/win check
        old_x, old_y = self.x, self.y
        
        # Flight dynamics step
        new_x, new_y = self.flight.step(thrust, turn)
        
        # Check win BEFORE collision
        if self.maze.check_win(old_x, old_y, new_x, new_y):
            self.state.game_state = GameState.WON
            self.state.win_step = self.state.step
            return GameState.WON
        
        # Wall collision
        final_x, final_y, edge = self.maze.check_wall_collision(
            old_x, old_y, new_x, new_y
        )
        if edge:
            # Compute normal angle for reflection
            if edge == "left":
                normal = 0  # Wall faces right
            elif edge == "right":
                normal = np.pi  # Wall faces left
            elif edge == "bottom":
                normal = np.pi / 2  # Wall faces up
            else:  # top
                normal = -np.pi / 2  # Wall faces down
            
            self.flight.apply_collision(final_x, final_y, normal)
        
        # Jar collision
        jar_x, jar_y, blocked = self.maze.check_jar_collision(
            old_x, old_y, self.x, self.y
        )
        if blocked:
            # Deflect along jar surface
            angle_from_jar = np.arctan2(jar_y - self.maze.jar.y, jar_x - self.maze.jar.x)
            normal = angle_from_jar  # Normal points outward from jar center
            self.flight.apply_collision(jar_x, jar_y, normal)
        
        # Arena boundary
        final_x, final_y, hit = self.maze.check_boundary(self.x, self.y)
        if hit:
            # Determine which boundary
            if self.x <= 5:
                normal = 0
            elif self.x >= self.maze.width - 5:
                normal = np.pi
            elif self.y <= 5:
                normal = np.pi / 2
            else:
                normal = -np.pi / 2
            
            self.flight.apply_collision(final_x, final_y, normal)
        
        self.state.step += 1
        
        # Check timeout
        if self.state.step >= self.maze.time_limit:
            self.state.game_state = GameState.TIMEOUT
            return GameState.TIMEOUT
        
        return GameState.RUNNING
    
    def run_until_done(self, max_steps: Optional[int] = None) -> GameState:
        """Run until win, timeout, or max_steps."""
        max_steps = max_steps or self.maze.time_limit
        
        while self.state.step < max_steps:
            result = self.step()
            if result != GameState.RUNNING:
                return result
        
        self.state.game_state = GameState.TIMEOUT
        return GameState.TIMEOUT
    
    def get_metrics(self) -> Dict:
        """Get simulation metrics."""
        path = np.array([self.path_x, self.path_y]).T
        
        # Compute path length
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
            "mode": "FLIGHT",
        }
        
        if self.maze.jar:
            jar = self.maze.jar
            distances = np.sqrt(
                (path[:, 0] - jar.x) ** 2 + (path[:, 1] - jar.y) ** 2
            )
            metrics["mean_distance_to_jar"] = float(np.mean(distances))
            metrics["min_distance_to_jar"] = float(np.min(distances))
            metrics["final_distance_to_jar"] = float(distances[-1])
        
        if self.state.game_state == GameState.WON:
            metrics["win_step"] = self.state.win_step
        
        # Flight-specific metrics
        if len(self.flight.path_x) > 1:
            speeds = []
            for i in range(1, len(self.flight.path_x)):
                dx = self.flight.path_x[i] - self.flight.path_x[i-1]
                dy = self.flight.path_y[i] - self.flight.path_y[i-1]
                speeds.append(np.sqrt(dx**2 + dy**2))
            metrics["mean_speed"] = float(np.mean(speeds))
            metrics["max_speed"] = float(np.max(speeds))
        
        return metrics


def create_flight_herding_level() -> Maze:
    """
    Create a level optimized for flying herding.
    
    Larger arena, wider corridors, stronger attractants for fast flight.
    """
    maze = Maze(
        width=700,
        height=350,
        name="Flight Herding",
        time_limit=1500,  # Shorter - flight is faster
    )
    
    # Fly starts on left
    maze.fly_start_x = 60
    maze.fly_start_y = 175
    maze.fly_start_theta = 0  # Facing right
    
    # Wider corridors for flight
    maze.add_wall(0, 280, 250, 70)     # Top-left wall
    maze.add_wall(300, 280, 400, 70)   # Top-right wall
    
    maze.add_wall(0, 0, 250, 70)       # Bottom-left wall
    maze.add_wall(300, 0, 400, 70)     # Bottom-right wall
    
    # Strong fruit trail for fast flight
    maze.add_stimulus(StimulusType.FRUIT, 150, 175, intensity=1.0, sigma=80)
    maze.add_stimulus(StimulusType.FRUIT, 280, 175, intensity=1.2, sigma=70)
    maze.add_stimulus(StimulusType.FRUIT, 420, 175, intensity=1.4, sigma=70)
    maze.add_stimulus(StimulusType.FRUIT, 540, 175, intensity=1.5, sigma=80)
    
    # Jar at the end with strong bait
    maze.set_jar(
        x=630,
        y=175,
        radius=45,
        opening_direction=np.pi,  # Opening faces left
        opening_width=0.8,        # Wide opening for fast entry
        has_bait=True,
        bait_intensity=1.2,       # Strong bait
    )
    
    return maze
