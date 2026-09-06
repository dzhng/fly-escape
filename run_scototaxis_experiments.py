#!/usr/bin/env python3
"""
SPIKE: Full scototaxis experiments with metrics and visualizations.

Results so far (quick test):
- Shadow Arena: Fly ended at x=62 (shadow at x=80) ✅ Shadow preference
- Light Arena: Fly ended at x=361 (light at x=80) ✅ Light avoidance

Now test: corridor choice, conflict scenarios.
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


def create_conflict_arena() -> Maze:
    """Fruit in bright zone vs empty shadow."""
    maze = Maze(
        width=400,
        height=250,
        name="Conflict: Fruit in Light",
        time_limit=500,
    )
    
    maze.fly_start_x = 200
    maze.fly_start_y = 125
    maze.fly_start_theta = 0
    
    # Fruit + LIGHT on RIGHT (smell good but bright)
    maze.add_stimulus(StimulusType.FRUIT, 320, 125, intensity=1.0, sigma=50)
    maze.add_stimulus(StimulusType.LIGHT, 320, 125, intensity=1.2, sigma=70)
    
    # Shadow on LEFT (no food but dark)
    maze.add_stimulus(StimulusType.SHADOW, 80, 125, intensity=1.2, sigma=70)
    
    return maze


def create_shadow_both_sides() -> Maze:
    """Shadow zones on both sides - test for turning behavior."""
    maze = Maze(
        width=400,
        height=250,
        name="Shadow Both Sides",
        time_limit=500,
    )
    
    maze.fly_start_x = 200
    maze.fly_start_y = 125
    maze.fly_start_theta = 0  # Facing right
    
    # Equal shadows on both sides
    maze.add_stimulus(StimulusType.SHADOW, 80, 125, intensity=1.0, sigma=50)
    maze.add_stimulus(StimulusType.SHADOW, 320, 125, intensity=1.0, sigma=50)
    
    return maze


def run_multi_seed_test(graph, maze, name, seeds=[42, 123, 456], max_steps=500):
    """Run test with multiple seeds."""
    print(f"\n=== {name} ===")
    
    all_results = []
    all_paths = []
    
    for seed in seeds:
        sim = FeedingMazeSimulator(
            graph=graph, maze=maze, seed=seed,
            odor_current=5.0, starve_time_steps=10000,
        )
        
        t0 = time.time()
        for _ in range(max_steps):
            if sim.step() != GameState.RUNNING:
                break
        elapsed = time.time() - t0
        
        path_x = np.array(sim.path_x)
        path_y = np.array(sim.path_y)
        all_paths.append((seed, path_x, path_y))
        
        # Compute metrics
        shadow_time = 0
        light_time = 0
        fruit_dist_min = float('inf')
        
        for x, y in zip(path_x, path_y):
            for stim in maze.stimuli:
                dist = np.sqrt((x - stim.x)**2 + (y - stim.y)**2)
                if stim.type == StimulusType.SHADOW and dist < stim.sigma:
                    shadow_time += 1
                elif stim.type == StimulusType.LIGHT and dist < stim.sigma:
                    light_time += 1
                elif stim.type == StimulusType.FRUIT:
                    fruit_dist_min = min(fruit_dist_min, dist)
        
        result = {
            "seed": seed,
            "steps": sim.state.step,
            "mean_x": float(np.mean(path_x)),
            "final_x": float(path_x[-1]),
            "final_y": float(path_y[-1]),
            "shadow_time": shadow_time,
            "light_time": light_time,
            "fruit_dist_min": fruit_dist_min,
            "fed_count": sim.state.total_feeds,
        }
        all_results.append(result)
        
        print(f"  Seed {seed}: shadow={shadow_time}, light={light_time}, "
              f"final=({path_x[-1]:.0f}, {path_y[-1]:.0f})")
    
    # Plot all paths
    fig, ax = plt.subplots(figsize=(10, 6))
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
        elif stim.type == StimulusType.FRUIT:
            circle = plt.Circle((stim.x, stim.y), stim.sigma, color='green', alpha=0.3)
            ax.add_patch(circle)
    
    colors = ['blue', 'red', 'purple']
    for i, (seed, px, py) in enumerate(all_paths):
        ax.plot(px, py, color=colors[i % len(colors)], alpha=0.7, linewidth=1, 
               label=f'seed {seed}')
        ax.scatter(px[0], py[0], color=colors[i % len(colors)], marker='o', s=50)
        ax.scatter(px[-1], py[-1], color=colors[i % len(colors)], marker='x', s=100)
    
    mean_shadow = np.mean([r["shadow_time"] for r in all_results])
    mean_light = np.mean([r["light_time"] for r in all_results])
    ax.set_title(f"{name}\nShadow time: {mean_shadow:.0f}, Light time: {mean_light:.0f}")
    ax.legend(loc='upper right')
    
    fig.tight_layout()
    fig.savefig(ARTIFACTS_DIR / f"{name.replace(' ', '_').replace(':', '').lower()}.png", dpi=150)
    plt.close(fig)
    
    return all_results


def main():
    print("=== SCOTOTAXIS EXPERIMENTS ===")
    
    # Load graph
    print("Loading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    all_experiments = {}
    
    # Experiment: Conflict (fruit in light vs empty shadow)
    maze3 = create_conflict_arena()
    results3 = run_multi_seed_test(graph, maze3, "Conflict: Fruit in Light", 
                                    seeds=[42, 123, 456])
    all_experiments["conflict"] = results3
    
    # Experiment: Shadow on both sides (symmetry test)
    maze4 = create_shadow_both_sides()
    results4 = run_multi_seed_test(graph, maze4, "Shadow Both Sides",
                                    seeds=[42, 123, 456])
    all_experiments["shadow_both"] = results4
    
    # Summary
    print("\n" + "="*60)
    print("=== SUMMARY ===")
    
    # Conflict analysis
    print("\nConflict (fruit+light vs shadow):")
    for r in results3:
        if r["fed_count"] > 0:
            print(f"  Seed {r['seed']}: FED (chemotaxis won)")
        elif r["shadow_time"] > 50:
            print(f"  Seed {r['seed']}: SHADOW (scototaxis won)")
        else:
            print(f"  Seed {r['seed']}: MIXED")
    
    # Save results
    with open(ARTIFACTS_DIR / "experiments_results.json", "w") as f:
        json.dump(all_experiments, f, indent=2)
    
    print(f"\nArtifacts saved to {ARTIFACTS_DIR}")
    
    # Final interpretation
    print("\n=== INTERPRETATION ===")
    print("""
AOTU scototaxis pathway behavior:
- Light zones: Fly AVOIDS (AOTU injection → ipsilateral DN → turn away)
- Shadow zones: Fly is ATTRACTED (same mechanism inverted interpretation)
- Conflict: Chemotaxis (fruit odor) vs scototaxis (shadow) compete

PURITY:
- Detection: ⚠️ Geometric (distance to shadow/light zone)
- AOTU injection: ✅ Pure graph
- AOTU→DN pathway: ✅ Pure graph (ipsilateral activation)
- Motor output: ✅ From graph dynamics
""")


if __name__ == "__main__":
    main()
