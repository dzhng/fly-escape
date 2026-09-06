#!/usr/bin/env python3
"""
QUICK SPIKE: Walk-vs-Fly Economy (minimal test)

Demonstrates dual-mode locomotion with reduced step counts.
"""

import sys
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import json

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))
sys.path.insert(0, str(Path(__file__).parent))

from graph_loader import VisualMotorGraph
from feeding_maze_sim import FeedingMazeSimulator
from maze import Maze, Stimulus, StimulusType


def create_test_arena(distance: float = 250.0) -> Maze:
    """Create arena with fruit at specified distance."""
    maze = Maze(
        width=600, height=400,
        fly_start_x=100, fly_start_y=200,
        fly_start_theta=0,  # Facing right
    )
    
    maze.stimuli.append(Stimulus(
        type=StimulusType.FRUIT,
        x=100 + distance,
        y=200,
        intensity=1.0,
        sigma=80.0,
    ))
    
    return maze


def run_quick_test(
    graph,
    maze: Maze,
    max_steps: int,
    seed: int,
    allow_takeoff: bool = True,
    start_flying: bool = False,
) -> dict:
    """Run quick simulation test."""
    sim = FeedingMazeSimulator(
        graph=graph,
        maze=maze,
        seed=seed,
    )
    
    # Modify takeoff parameters BEFORE reset
    if not allow_takeoff:
        # Disable takeoff by setting very high threshold
        sim.landing_feeding.params.takeoff_hunger_threshold = 10.0
        sim.landing_feeding.params.takeoff_threat_gain = 0.0
    else:
        # Enable takeoff: when hunger > threshold, inject DNb01/DNb02
        # Use realistic threshold (0.6 = moderately hungry)
        sim.landing_feeding.params.takeoff_hunger_threshold = 0.6
        sim.landing_feeding.params.takeoff_hunger_gain = 10.0  # Strong drive
        sim.landing_feeding.params.takeoff_dn_threshold = 0.5  # DN activity threshold for actual takeoff
    
    # Reset AFTER setting params
    sim.reset(new_seed=seed, start_flying=start_flying)
    
    print(f"  Takeoff threshold: {sim.landing_feeding.params.takeoff_hunger_threshold}")
    
    # Debug: Check takeoff current injection once
    debug_currents = sim.landing_feeding.get_takeoff_currents(
        hunger_level=sim.landing_feeding.hunger.level,
        escape_loom=0.0,
        is_walking=sim.flight.is_walking,
    )
    print(f"  DEBUG: takeoff currents count = {len(debug_currents)}, "
          f"is_walking={sim.flight.is_walking}, hunger={sim.landing_feeding.hunger.level:.2f}")
    
    # Run
    for step in range(max_steps):
        state = sim.step()
        
        # Print progress every 100 steps
        if step % 100 == 0 or step < 5:
            mode = sim.flight.mode.value
            behavior = sim.landing_feeding.behavior_state.value
            hunger = sim.landing_feeding.hunger.level
            takeoff_act = sim.state.takeoff_dn_activities[-1] if sim.state.takeoff_dn_activities else 0
            dist_to_fruit = np.sqrt((sim.x - 350) ** 2 + (sim.y - 200) ** 2)
            print(f"  Step {step}: flight_mode={mode}, behavior={behavior}, hunger={hunger:.2f}, "
                  f"takeoff_dn={takeoff_act:.3f}, dist={dist_to_fruit:.1f}")
        
        if state.value != "running":
            break
    
    # Get metrics
    metrics = sim.get_metrics()
    metrics["seed"] = seed
    metrics["allow_takeoff"] = allow_takeoff
    metrics["start_flying"] = start_flying
    metrics["path_x"] = sim.path_x.copy()
    metrics["path_y"] = sim.path_y.copy()
    
    return metrics


def main():
    print("=" * 60)
    print("QUICK SPIKE: Walk-vs-Fly Economy")
    print("=" * 60)
    
    # Load graph
    print("\nLoading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    # Create output directory
    out_dir = Path("artifacts/walk_vs_fly")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Quick test: 500 steps (enough to see takeoff)
    max_steps = 500
    seed = 42
    distance = 250  # Medium distance
    
    print("\n" + "-" * 60)
    print(f"TEST: Distance = {distance}, Max steps = {max_steps}")
    print("-" * 60)
    
    maze = create_test_arena(distance=distance)
    
    # Run walk-only
    print("\n1. Walk-only mode (takeoff disabled)...")
    walk_result = run_quick_test(graph, maze, max_steps, seed, allow_takeoff=False)
    print(f"   Final: {walk_result['final_state']}, "
          f"mode_walking_ratio={walk_result.get('mode_walking_ratio', 'N/A')}")
    
    # Run dual-mode
    print("\n2. Dual mode (takeoff enabled)...")
    dual_result = run_quick_test(graph, maze, max_steps, seed, allow_takeoff=True)
    print(f"   Final: {dual_result['final_state']}, "
          f"first_takeoff={dual_result['first_takeoff_step']}, "
          f"mode_flying_ratio={dual_result.get('mode_flying_ratio', 'N/A')}")
    
    # Plot comparison
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    # Walk-only path
    ax = axes[0]
    ax.plot(walk_result['path_x'], walk_result['path_y'], 'b-', alpha=0.7, label='Path')
    ax.scatter([100], [200], c='black', s=100, marker='o', zorder=5, label='Start')
    ax.scatter([100 + distance], [200], c='green', s=200, marker='*', zorder=5, label='Fruit')
    ax.set_xlim(0, 600)
    ax.set_ylim(0, 400)
    ax.set_title(f'Walk-only\n{walk_result["final_state"]}')
    ax.set_aspect('equal')
    ax.legend()
    
    # Dual-mode path
    ax = axes[1]
    ax.plot(dual_result['path_x'], dual_result['path_y'], 'r-', alpha=0.7, label='Path')
    ax.scatter([100], [200], c='black', s=100, marker='o', zorder=5, label='Start')
    ax.scatter([100 + distance], [200], c='green', s=200, marker='*', zorder=5, label='Fruit')
    ax.set_xlim(0, 600)
    ax.set_ylim(0, 400)
    ax.set_title(f'Dual mode (walk→fly)\nFirst takeoff: step {dual_result["first_takeoff_step"]}')
    ax.set_aspect('equal')
    ax.legend()
    
    plt.tight_layout()
    plt.savefig(out_dir / "walk_vs_fly_quick.png", dpi=150)
    print(f"\nSaved: {out_dir / 'walk_vs_fly_quick.png'}")
    
    # Summary
    print("\n" + "=" * 60)
    print("QUICK SPIKE FINDINGS")
    print("=" * 60)
    print(f"""
DUAL KINEMATICS:
  - WALKING: max_speed=1.2, high drag
  - FLYING: max_speed=4.0, low drag

TAKEOFF TRIGGER:
  - Hunger > 0.6 → inject DNb01/DNb02 (flight initiation)
  - First takeoff step: {dual_result.get('first_takeoff_step', 'None')}

MODE RATIOS:
  - Walk-only: walking={walk_result.get('mode_walking_ratio', 0):.0%}
  - Dual mode: flying={dual_result.get('mode_flying_ratio', 0):.0%}

CONCLUSIONS:
  - Takeoff system {"WORKING" if dual_result.get('first_takeoff_step') else "NOT TRIGGERED"}
  - Dual mode covers {"more" if len(dual_result['path_x']) > 0 and max(dual_result['path_x']) > max(walk_result['path_x']) else "similar"} distance
""")
    
    plt.close()


if __name__ == "__main__":
    main()
