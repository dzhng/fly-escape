#!/usr/bin/env python3
"""
SPIKE: Quick test of AOTU scototaxis (shadow preference) in the game loop.

Simplified experiments with fewer steps to run faster.
"""

import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import json
import time

from src.graph_loader import VisualMotorGraph
from src.maze import Maze, StimulusType
from src.feeding_maze_sim import FeedingMazeSimulator, GameState

ARTIFACTS_DIR = Path("artifacts/scototaxis")
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def create_simple_shadow_arena() -> Maze:
    """Simple arena with one shadow zone."""
    maze = Maze(
        width=400,
        height=250,
        name="Shadow Arena",
        time_limit=500,
    )
    
    # Fly starts in center
    maze.fly_start_x = 200
    maze.fly_start_y = 125
    maze.fly_start_theta = np.pi / 4  # Facing diagonal
    
    # Shadow zone on LEFT side
    maze.add_stimulus(StimulusType.SHADOW, 80, 125, intensity=1.5, sigma=60)
    
    return maze


def create_simple_light_arena() -> Maze:
    """Simple arena with one light zone."""
    maze = Maze(
        width=400,
        height=250,
        name="Light Arena",
        time_limit=500,
    )
    
    # Fly starts in center
    maze.fly_start_x = 200
    maze.fly_start_y = 125
    maze.fly_start_theta = -np.pi / 4  # Facing diagonal other way
    
    # Light zone on LEFT side  
    maze.add_stimulus(StimulusType.LIGHT, 80, 125, intensity=1.5, sigma=60)
    
    return maze


def run_quick_test(graph, maze, name, seed=42, max_steps=500):
    """Run a single quick test."""
    print(f"\n--- {name} (seed={seed}) ---")
    
    sim = FeedingMazeSimulator(
        graph=graph,
        maze=maze,
        seed=seed,
        odor_current=5.0,
        starve_time_steps=10000,
    )
    
    t0 = time.time()
    
    # Run simulation
    for step in range(max_steps):
        state = sim.step()
        if state != GameState.RUNNING:
            break
        
        if step % 100 == 0:
            print(f"  Step {step}: pos=({sim.x:.0f}, {sim.y:.0f})")
    
    elapsed = time.time() - t0
    print(f"  Completed in {elapsed:.1f}s ({sim.state.step} steps)")
    
    # Compute metrics
    path_x = np.array(sim.path_x)
    path_y = np.array(sim.path_y)
    
    # Distance to shadow center (x=80)
    mean_x = np.mean(path_x)
    final_x = path_x[-1]
    
    # Time in shadow zone
    shadow_time = 0
    for stim in maze.stimuli:
        if stim.type == StimulusType.SHADOW:
            for x, y in zip(path_x, path_y):
                dist = np.sqrt((x - stim.x)**2 + (y - stim.y)**2)
                if dist < stim.sigma:
                    shadow_time += 1
    
    print(f"  Mean X: {mean_x:.1f}, Final X: {final_x:.1f}")
    print(f"  Shadow time: {shadow_time}")
    
    # Plot
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.set_xlim(0, maze.width)
    ax.set_ylim(0, maze.height)
    ax.set_aspect('equal')
    
    for stim in maze.stimuli:
        if stim.type == StimulusType.SHADOW:
            circle = plt.Circle((stim.x, stim.y), stim.sigma, color='gray', alpha=0.3)
            ax.add_patch(circle)
        elif stim.type == StimulusType.LIGHT:
            circle = plt.Circle((stim.x, stim.y), stim.sigma, color='yellow', alpha=0.3)
            ax.add_patch(circle)
    
    ax.plot(path_x, path_y, 'b-', alpha=0.7, linewidth=1)
    ax.scatter(path_x[0], path_y[0], color='green', marker='o', s=100, label='Start')
    ax.scatter(path_x[-1], path_y[-1], color='red', marker='x', s=100, label='End')
    
    ax.set_title(f"{name}\nMean X: {mean_x:.1f}, Shadow time: {shadow_time}")
    ax.legend()
    
    fig.tight_layout()
    fig.savefig(ARTIFACTS_DIR / f"{name.replace(' ', '_').lower()}.png", dpi=100)
    plt.close(fig)
    
    return {
        "mean_x": mean_x,
        "final_x": final_x,
        "shadow_time": shadow_time,
        "steps": sim.state.step,
    }


def main():
    print("=== QUICK SCOTOTAXIS TEST ===")
    print()
    
    # Load graph
    print("Loading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    # Count AOTU neurons in subgraph
    from src.landing_feeding import AOTU_LEFT, AOTU_RIGHT
    aotu_l_in = sum(1 for b in AOTU_LEFT if b in graph.body_to_idx)
    aotu_r_in = sum(1 for b in AOTU_RIGHT if b in graph.body_to_idx)
    print(f"AOTU neurons in subgraph: L={aotu_l_in}, R={aotu_r_in}")
    
    results = {}
    
    # Test 1: Shadow arena
    print("\n" + "="*50)
    print("TEST 1: Shadow zone attraction")
    maze1 = create_simple_shadow_arena()
    r1 = run_quick_test(graph, maze1, "Shadow Arena", seed=42, max_steps=500)
    results["shadow"] = r1
    
    # Test 2: Light arena
    print("\n" + "="*50)
    print("TEST 2: Light zone avoidance")
    maze2 = create_simple_light_arena()
    r2 = run_quick_test(graph, maze2, "Light Arena", seed=42, max_steps=500)
    results["light"] = r2
    
    # Summary
    print("\n" + "="*50)
    print("=== SUMMARY ===")
    
    print(f"\nShadow arena: mean_x={r1['mean_x']:.1f} (shadow at x=80)")
    if r1['mean_x'] < 150:
        print("  ✅ Fly moved toward shadow")
    else:
        print("  ⚠️ Fly did not clearly prefer shadow")
    
    print(f"\nLight arena: mean_x={r2['mean_x']:.1f} (light at x=80)")
    if r2['mean_x'] > 150:
        print("  ✅ Fly avoided light")
    else:
        print("  ⚠️ Fly did not clearly avoid light")
    
    # Save
    with open(ARTIFACTS_DIR / "quick_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nArtifacts saved to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    main()
