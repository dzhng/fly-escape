"""
Maze simulation runner using pure-graph MaleCNS chemotaxis.

CRITICAL: NO external turn bias. All chemotaxis emerges from:
1. Bilateral odor sensing at antenna positions
2. Asymmetric current injection to excitatory LH neurons
3. Olfactory-specific DN motor readout

The maze provides odor concentration fields that feed into the
existing bilateral olfactory injection system.
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
from .maze import Maze, StimulusType, create_herding_level


class GameState(Enum):
    RUNNING = "running"
    WON = "won"
    TIMEOUT = "timeout"
    RETRY = "retry"


@dataclass
class MazeOdorSource:
    """Adapter to make maze stimuli look like OdorSource for olfaction."""
    x: float
    y: float
    intensity: float
    sigma: float
    
    def concentration(self, px: float, py: float) -> float:
        d2 = (px - self.x) ** 2 + (py - self.y) ** 2
        return self.intensity * np.exp(-d2 / (2 * self.sigma ** 2))


@dataclass
class MazeSimState:
    """State of a maze simulation run."""
    step: int = 0
    state: GameState = GameState.RUNNING
    
    x: float = 0.0
    y: float = 0.0
    theta: float = 0.0
    
    path_x: List[float] = None
    path_y: List[float] = None
    path_theta: List[float] = None
    thrusts: List[float] = None
    turns: List[float] = None
    
    win_step: Optional[int] = None
    
    def __post_init__(self):
        if self.path_x is None:
            self.path_x = []
            self.path_y = []
            self.path_theta = []
            self.thrusts = []
            self.turns = []


class MazeSimulator:
    """
    Maze simulation with pure-graph chemotaxis.
    
    CRITICAL: No external turn bias. Turn signal emerges from:
    - Bilateral antenna sensing
    - Asymmetric LH neuron activation
    - Olfactory-specific DN L/R difference
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
        
        # Build odor sources from maze stimuli
        self.odor_sources = self._build_odor_sources()
        
        # Kinematics parameters
        self.max_speed = 1.5
        self.max_angular = 0.15
        self.thrust_scale = 1.0
        self.turn_scale = 0.12
        self.dt = 1.0
        
        # State
        self.state = MazeSimState()
        self.reset()
    
    def _build_odor_sources(self) -> List[MazeOdorSource]:
        """Convert maze stimuli to odor sources for injection."""
        sources = []
        
        for stim in self.maze.stimuli:
            # Only attractive stimuli become odor sources
            if stim.type in [StimulusType.FRUIT, StimulusType.JAR_BAIT]:
                sources.append(MazeOdorSource(
                    x=stim.x,
                    y=stim.y,
                    intensity=stim.intensity,
                    sigma=stim.sigma,
                ))
            elif stim.type == StimulusType.LIGHT:
                # Light: weak attractive
                sources.append(MazeOdorSource(
                    x=stim.x,
                    y=stim.y,
                    intensity=stim.intensity * 0.3,
                    sigma=stim.sigma,
                ))
            # Note: Vinegar/shadow could inject to aversive pathways
            # For now, they just reduce overall attractive drive
        
        return sources
    
    def reset(self, new_seed: Optional[int] = None):
        """Reset simulation to initial state."""
        if new_seed is not None:
            self.seed = new_seed
        
        self.lif.reset(self.seed)
        
        self.state = MazeSimState(
            x=self.maze.fly_start_x,
            y=self.maze.fly_start_y,
            theta=self.maze.fly_start_theta,
        )
        self.state.path_x.append(self.state.x)
        self.state.path_y.append(self.state.y)
        self.state.path_theta.append(self.state.theta)
    
    def step(self) -> GameState:
        """
        Run one simulation step.
        
        CRITICAL: Turn emerges from pure graph dynamics, not external bias.
        """
        if self.state.state != GameState.RUNNING:
            return self.state.state
        
        # Get bilateral odor currents (NO external turn bias!)
        currents = self.olfactory.get_bilateral_odor_currents(
            fly_x=self.state.x,
            fly_y=self.state.y,
            fly_theta=self.state.theta,
            odor_sources=self.odor_sources,
            odor_blend=FRUIT_ESTER_BLEND,
            base_current=self.odor_current,
        )
        self.lif.set_external_current(currents)
        
        # LIF step - motor output from graph
        spikes, thrust, turn = self.lif.step()
        
        # Apply physical effects (wind only)
        phys = self.maze.get_physical_effects_at(self.state.x, self.state.y)
        thrust += phys["thrust_push"]
        turn += phys["lateral_push"] * 0.1
        
        # Record
        self.state.thrusts.append(thrust)
        self.state.turns.append(turn)
        
        # Kinematics
        speed = np.clip(thrust * self.thrust_scale, -self.max_speed, self.max_speed)
        omega = np.clip(turn * self.turn_scale, -self.max_angular, self.max_angular)
        
        new_theta = self.state.theta + omega * self.dt
        new_theta = (new_theta + np.pi) % (2 * np.pi) - np.pi
        
        dx = speed * np.cos(new_theta) * self.dt
        dy = speed * np.sin(new_theta) * self.dt
        
        old_x, old_y = self.state.x, self.state.y
        new_x = old_x + dx
        new_y = old_y + dy
        
        # Check win BEFORE collision (fly enters jar)
        if self.maze.check_win(old_x, old_y, new_x, new_y):
            self.state.x = new_x
            self.state.y = new_y
            self.state.theta = new_theta
            self.state.path_x.append(self.state.x)
            self.state.path_y.append(self.state.y)
            self.state.path_theta.append(self.state.theta)
            self.state.state = GameState.WON
            self.state.win_step = self.state.step
            return GameState.WON
        
        # Wall collision
        new_x, new_y, edge = self.maze.check_wall_collision(old_x, old_y, new_x, new_y)
        if edge:
            # Reflect heading
            if edge in ["left", "right"]:
                new_theta = np.pi - new_theta
            else:
                new_theta = -new_theta
            new_theta += np.random.uniform(-0.2, 0.2)
            new_theta = (new_theta + np.pi) % (2 * np.pi) - np.pi
        
        # Jar wall collision
        new_x, new_y, blocked = self.maze.check_jar_collision(old_x, old_y, new_x, new_y)
        if blocked:
            # Deflect along jar surface
            angle_to_jar = np.arctan2(new_y - self.maze.jar.y, new_x - self.maze.jar.x)
            new_theta = angle_to_jar + np.pi / 2 + np.random.uniform(-0.3, 0.3)
            new_theta = (new_theta + np.pi) % (2 * np.pi) - np.pi
        
        # Arena boundary
        new_x, new_y, hit = self.maze.check_boundary(new_x, new_y)
        if hit:
            if new_x <= 5 or new_x >= self.maze.width - 5:
                new_theta = np.pi - new_theta
            if new_y <= 5 or new_y >= self.maze.height - 5:
                new_theta = -new_theta
            new_theta += np.random.uniform(-0.2, 0.2)
            new_theta = (new_theta + np.pi) % (2 * np.pi) - np.pi
        
        # Update state
        self.state.x = new_x
        self.state.y = new_y
        self.state.theta = new_theta
        self.state.step += 1
        
        self.state.path_x.append(self.state.x)
        self.state.path_y.append(self.state.y)
        self.state.path_theta.append(self.state.theta)
        
        # Check timeout
        if self.state.step >= self.maze.time_limit:
            self.state.state = GameState.TIMEOUT
            return GameState.TIMEOUT
        
        return GameState.RUNNING
    
    def run_until_done(self, max_steps: Optional[int] = None) -> GameState:
        """Run until win, timeout, or max_steps."""
        max_steps = max_steps or self.maze.time_limit
        
        while self.state.step < max_steps:
            result = self.step()
            if result != GameState.RUNNING:
                return result
        
        self.state.state = GameState.TIMEOUT
        return GameState.TIMEOUT
    
    def get_metrics(self) -> Dict:
        """Get simulation metrics."""
        path = np.array([self.state.path_x, self.state.path_y]).T
        
        metrics = {
            "total_steps": self.state.step,
            "final_state": self.state.state.value,
            "path_length": float(np.sum(np.sqrt(
                np.diff(path[:, 0]) ** 2 + np.diff(path[:, 1]) ** 2
            ))),
        }
        
        if self.maze.jar:
            jar = self.maze.jar
            distances = np.sqrt(
                (path[:, 0] - jar.x) ** 2 + (path[:, 1] - jar.y) ** 2
            )
            metrics["mean_distance_to_jar"] = float(np.mean(distances))
            metrics["min_distance_to_jar"] = float(np.min(distances))
            metrics["final_distance_to_jar"] = float(distances[-1])
        
        if self.state.state == GameState.WON:
            metrics["win_step"] = self.state.win_step
        
        return metrics


def run_maze_simulation(
    graph: MaleCNSGraph,
    maze: Optional[Maze] = None,
    seed: int = 42,
    odor_current: float = 5.0,
    save_every: int = 2,
) -> Tuple[MazeSimulator, List[np.ndarray]]:
    """
    Run a complete maze simulation.
    
    Returns:
        (simulator, frames) - simulator with final state and list of frames
    """
    if maze is None:
        maze = create_herding_level()
    
    print(f"\n{'='*60}")
    print(f"MAZE SIMULATION: {maze.name}")
    print(f"{'='*60}")
    print(f"  [PURE GRAPH chemotaxis - NO external turn bias]")
    print(f"  Fly start: ({maze.fly_start_x}, {maze.fly_start_y})")
    if maze.jar:
        print(f"  Jar at: ({maze.jar.x}, {maze.jar.y})")
    print(f"  Time limit: {maze.time_limit} steps")
    
    sim = MazeSimulator(graph, maze, seed=seed, odor_current=odor_current)
    
    frames = []
    
    print(f"\nRunning simulation...")
    while sim.state.state == GameState.RUNNING:
        result = sim.step()
        
        if sim.state.step % 200 == 0:
            jar_dist = ""
            if maze.jar:
                d = np.sqrt(
                    (sim.state.x - maze.jar.x) ** 2 + 
                    (sim.state.y - maze.jar.y) ** 2
                )
                jar_dist = f", jar_dist={d:.1f}"
            print(f"  Step {sim.state.step}: pos=({sim.state.x:.1f}, {sim.state.y:.1f}){jar_dist}")
        
        if sim.state.step % save_every == 0:
            # Frame will be rendered later
            pass
    
    print(f"\nSimulation complete!")
    print(f"  Result: {sim.state.state.value.upper()}")
    print(f"  Steps: {sim.state.step}")
    
    metrics = sim.get_metrics()
    if maze.jar:
        print(f"  Min distance to jar: {metrics['min_distance_to_jar']:.1f}")
    
    if sim.state.state == GameState.WON:
        print(f"  WIN at step {sim.state.win_step}!")
    
    return sim, frames
