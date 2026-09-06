#!/usr/bin/env python3
"""
MINIMAL SPIKE: Walk-vs-Fly Economy

Quick test with just 1 seed to demonstrate the mechanic.
"""

import sys
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import json

sys.path.insert(0, str(Path(__file__).parent / "src"))
sys.path.insert(0, str(Path(__file__).parent))

from graph_loader import VisualMotorGraph
from feeding_maze_sim import FeedingMazeSimulator
from maze import Maze, Stimulus, StimulusType


def main():
    print("=" * 60)
    print("MINIMAL SPIKE: Walk-vs-Fly Economy")
    print("=" * 60)
    
    # Load graph
    print("\nLoading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    # Create output directory
    out_dir = Path("artifacts/walk_vs_fly")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Simple maze with fruit at medium distance
    maze = Maze(
        width=600, height=400,
        fly_start_x=100, fly_start_y=200,
        fly_start_theta=0,
    )
    maze.stimuli.append(Stimulus(
        type=StimulusType.FRUIT,
        x=400, y=200,  # 300 units away
        intensity=1.0, sigma=80.0,
    ))
    
    seed = 42
    max_steps = 400  # Just enough to see the mechanic
    
    print(f"\nLevel: Fruit 300 units away")
    print(f"Max steps: {max_steps}")
    
    # Test 1: Walk-only
    print("\n--- Walk-only mode ---")
    sim1 = FeedingMazeSimulator(graph=graph, maze=maze, seed=seed)
    sim1.landing_feeding.params.takeoff_hunger_threshold = 10.0  # Disable
    sim1.reset(new_seed=seed)
    
    walk_modes = []
    walk_dists = []
    for step in range(max_steps):
        sim1.step()
        walk_modes.append(sim1.flight.mode.value)
        walk_dists.append(np.sqrt((sim1.x - 400) ** 2 + (sim1.y - 200) ** 2))
        if step % 100 == 0:
            print(f"  Step {step}: mode={sim1.flight.mode.value}, dist={walk_dists[-1]:.0f}")
    
    walk_metrics = sim1.get_metrics()
    print(f"  Final: fed={walk_metrics['total_feeds']}, "
          f"walking_ratio={walk_metrics.get('mode_walking_ratio', 'N/A')}")
    
    # Test 2: Dual-mode
    print("\n--- Dual mode ---")
    sim2 = FeedingMazeSimulator(graph=graph, maze=maze, seed=seed)
    sim2.landing_feeding.params.takeoff_hunger_threshold = 0.6
    sim2.landing_feeding.params.takeoff_hunger_gain = 10.0
    sim2.reset(new_seed=seed)
    
    dual_modes = []
    dual_dists = []
    for step in range(max_steps):
        sim2.step()
        dual_modes.append(sim2.flight.mode.value)
        dual_dists.append(np.sqrt((sim2.x - 400) ** 2 + (sim2.y - 200) ** 2))
        if step % 100 == 0:
            print(f"  Step {step}: mode={sim2.flight.mode.value}, dist={dual_dists[-1]:.0f}")
    
    dual_metrics = sim2.get_metrics()
    print(f"  Final: fed={dual_metrics['total_feeds']}, "
          f"flying_ratio={dual_metrics.get('mode_flying_ratio', 'N/A')}, "
          f"first_takeoff={dual_metrics.get('first_takeoff_step')}")
    
    # Plot
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    
    # Paths
    ax = axes[0]
    ax.plot(sim1.path_x, sim1.path_y, 'b-', alpha=0.7, label='Walk-only', linewidth=2)
    ax.plot(sim2.path_x, sim2.path_y, 'r-', alpha=0.7, label='Dual mode', linewidth=2)
    ax.scatter([100], [200], c='black', s=100, marker='o', zorder=5, label='Start')
    ax.scatter([400], [200], c='green', s=200, marker='*', zorder=5, label='Fruit')
    ax.set_xlim(0, 600)
    ax.set_ylim(0, 400)
    ax.set_title('Paths')
    ax.set_aspect('equal')
    ax.legend()
    
    # Distance over time
    ax = axes[1]
    ax.plot(walk_dists, 'b-', label='Walk-only')
    ax.plot(dual_dists, 'r-', label='Dual mode')
    ax.axhline(30, color='g', linestyle='--', alpha=0.5, label='Contact range')
    ax.set_xlabel('Step')
    ax.set_ylabel('Distance to fruit')
    ax.set_title('Distance over time')
    ax.legend()
    
    # Mode timeline (dual only)
    ax = axes[2]
    mode_vals = [1 if m == 'flying' else 0 for m in dual_modes]
    ax.fill_between(range(len(mode_vals)), mode_vals, alpha=0.5, color='red', label='Flying')
    ax.fill_between(range(len(mode_vals)), [1 - v for v in mode_vals], alpha=0.5, color='blue', label='Walking')
    ax.set_xlabel('Step')
    ax.set_ylabel('Mode')
    ax.set_title('Dual mode: Locomotion')
    ax.legend()
    
    plt.tight_layout()
    plt.savefig(out_dir / "walk_vs_fly_minimal.png", dpi=150)
    print(f"\nSaved: {out_dir / 'walk_vs_fly_minimal.png'}")
    
    # Summary
    print("\n" + "=" * 60)
    print("SPIKE SUMMARY")
    print("=" * 60)
    
    walk_final_dist = walk_dists[-1]
    dual_final_dist = dual_dists[-1]
    
    print(f"""
Walk-only:
  - Final distance: {walk_final_dist:.0f}
  - Fed: {walk_metrics['total_feeds']}
  - Walking ratio: {walk_metrics.get('mode_walking_ratio', 0):.0%}

Dual mode:
  - Final distance: {dual_final_dist:.0f}
  - Fed: {dual_metrics['total_feeds']}
  - First takeoff: step {dual_metrics.get('first_takeoff_step', 'None')}
  - Flying ratio: {dual_metrics.get('mode_flying_ratio', 0):.0%}

KEY FINDING:
  - Dual mode {"reached fruit faster" if dual_final_dist < walk_final_dist else "similar distance"}
  - Takeoff triggered by hunger > 0.6 → DNb01/DNb02 injection
""")
    
    plt.close()


if __name__ == "__main__":
    main()
