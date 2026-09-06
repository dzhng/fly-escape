"""
Main simulation runner for MaleCNS fly arena.

CRITICAL: NO EXTERNAL TURN BIAS. Chemotaxis emerges purely from:
1. Bilateral (L/R) odor sensing at antenna positions
2. Asymmetric current injection to L/R olfactory neurons
3. Neural dynamics through the MaleCNS graph
4. DN/MN L/R asymmetry → motor output

The fly brain IS the AI. No shortcuts.
"""

import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import json

from .graph_loader import MaleCNSGraph, load_motor1hop
from .lif_sim import LIFSimulator, LIFParams
from .arena import Arena, ArenaConfig, OdorSource
from .olfaction import BilateralOlfactoryInjector
from .visualization import render_frame, save_frame, save_animation, plot_path_comparison


@dataclass
class SimulationConfig:
    """Configuration for a simulation run."""
    n_steps: int = 1500
    seed: int = 42
    save_every: int = 2
    
    arena_width: float = 300.0
    arena_height: float = 300.0
    fly_start_x: float = 150.0
    fly_start_y: float = 150.0
    fly_start_theta: float = 0.0
    
    fruit_x: Optional[float] = None
    fruit_y: Optional[float] = None
    fruit_intensity: float = 1.0
    fruit_sigma: float = 80.0
    
    # Injection parameters (NO external turn bias!)
    odor_base_current: float = 2.0  # Increased for stronger effect


def run_simulation(
    graph: MaleCNSGraph,
    config: SimulationConfig,
    with_odor: bool = False,
    output_dir: Optional[Path] = None,
    title_suffix: str = "",
) -> Tuple[Arena, np.ndarray, np.ndarray, List[np.ndarray]]:
    """
    Run a complete simulation with PURE GRAPH-BASED chemotaxis.
    
    NO external turn bias. Turning emerges from bilateral odor sensing
    and asymmetric neural activation through the MaleCNS graph.
    """
    print(f"\n{'='*60}")
    print(f"Running PURE LIF simulation: {'WITH ODOR' if with_odor else 'NO ODOR'} {title_suffix}")
    print(f"{'='*60}")
    print("  [NO external turn bias - chemotaxis from graph only]")
    
    arena_config = ArenaConfig(
        width=config.arena_width,
        height=config.arena_height,
        fly_start_x=config.fly_start_x,
        fly_start_y=config.fly_start_y,
        fly_start_theta=config.fly_start_theta,
    )
    arena = Arena(config=arena_config)
    
    if with_odor and config.fruit_x is not None:
        fruit = OdorSource(
            x=config.fruit_x,
            y=config.fruit_y,
            intensity=config.fruit_intensity,
            sigma=config.fruit_sigma,
            name="ripe_fruit",
        )
        arena.add_odor_source(fruit)
        print(f"  Fruit source at ({config.fruit_x:.0f}, {config.fruit_y:.0f})")
    
    print("\nInitializing LIF simulator...")
    params = LIFParams()
    sim = LIFSimulator(
        adjacency=graph.adjacency,
        body_to_idx=graph.body_to_idx,
        idx_to_body=graph.idx_to_body,
        params=params,
        seed=config.seed,
    )
    
    print("Setting up motor neurons...")
    sim.set_motor_neurons(graph.dn_bodies, graph.mn_bodies, graph)
    
    olfactory = None
    if with_odor:
        print("Setting up BILATERAL olfactory injection...")
        olfactory = BilateralOlfactoryInjector(graph.annotations, graph.body_to_idx)
    
    print(f"\nRunning {config.n_steps} steps (pure LIF, no external bias)...")
    thrusts = np.zeros(config.n_steps)
    turns = np.zeros(config.n_steps)
    frames = []
    
    for t in range(config.n_steps):
        # Bilateral odor injection (NO external turn bias!)
        if with_odor and olfactory:
            currents = olfactory.get_bilateral_odor_currents(
                fly_x=arena.x,
                fly_y=arena.y,
                fly_theta=arena.theta,
                odor_sources=arena.odor_sources,
                base_current=config.odor_base_current,
            )
            sim.set_external_current(currents)
        
        # LIF step - motor output emerges from graph
        spikes, thrust, turn = sim.step()
        
        # NO EXTERNAL BIAS ADDED TO TURN
        # turn = turn  (unchanged from LIF output)
        
        thrusts[t] = thrust
        turns[t] = turn
        
        arena.step(thrust, turn)
        
        if t % config.save_every == 0:
            frame = render_frame(
                arena,
                thrusts[:t+1],
                turns[:t+1],
                title=f"MaleCNS LIF fly {title_suffix}",
            )
            frames.append(frame)
        
        if t % 200 == 0:
            dist = arena.distance_to_source(0) if arena.odor_sources else 0
            print(f"  Step {t}: thrust={thrust:.3f}, turn={turn:.3f}, pos=({arena.x:.1f}, {arena.y:.1f}), dist={dist:.1f}")
    
    print(f"\nSimulation complete!")
    print(f"  Final position: ({arena.x:.1f}, {arena.y:.1f})")
    print(f"  Path length: {len(arena.path_x)} points")
    
    if with_odor and arena.odor_sources:
        metrics = arena.compute_metrics(0)
        print(f"  Mean distance to fruit: {metrics['mean_distance']:.1f}")
        print(f"  Final distance to fruit: {metrics['final_distance']:.1f}")
        print(f"  Mean heading alignment: {metrics['mean_heading_alignment']:.3f}")
    
    return arena, thrusts, turns, frames


def save_results(
    arena: Arena,
    thrusts: np.ndarray,
    turns: np.ndarray,
    frames: List[np.ndarray],
    output_dir: Path,
    prefix: str = "run",
):
    """Save simulation results to files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if frames:
        gif_path = output_dir / f"{prefix}_arena.gif"
        save_animation(frames, gif_path, fps=15)
        print(f"  Saved animation: {gif_path}")
        
        frame_path = output_dir / f"{prefix}_frame.png"
        save_frame(
            arena,
            thrusts,
            turns,
            frame_path,
            title=f"MaleCNS LIF fly — {prefix}",
        )
        print(f"  Saved frame: {frame_path}")
    
    motor_path = output_dir / f"{prefix}_motor_vector.csv"
    with open(motor_path, "w") as f:
        f.write("step,thrust,turn,x,y,theta\n")
        for i in range(len(thrusts)):
            f.write(f"{i},{thrusts[i]:.6f},{turns[i]:.6f},{arena.path_x[i]:.3f},{arena.path_y[i]:.3f},{arena.path_theta[i]:.6f}\n")
    print(f"  Saved motor vectors: {motor_path}")
    
    if arena.odor_sources:
        metrics = arena.compute_metrics(0)
        metrics_path = output_dir / f"{prefix}_metrics.json"
        with open(metrics_path, "w") as f:
            json.dump(metrics, f, indent=2)
        print(f"  Saved metrics: {metrics_path}")
    
    return {
        "gif": str(gif_path) if frames else None,
        "frame": str(frame_path) if frames else None,
        "motor_csv": str(motor_path),
    }
