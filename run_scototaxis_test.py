#!/usr/bin/env python3
"""
SPIKE: Test AOTU scototaxis (shadow preference) in the game loop.

EXPERIMENTS:
1. Empty arena + one shadow zone vs one bright zone — path heat / time-in-shadow
2. Corridor choice: lit vs dark path
3. Conflict: fruit odor in bright zone vs shadow elsewhere

SPIKE FINDING: AOTU→DNa02/DNa03 produces IPSILATERAL activation
- Shadow on L → AOTU_L → turn R → TOWARD shadow ✅
- Light on L → AOTU_L → turn R → AWAY from light ✅
"""

import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import json

from src.graph_loader import VisualMotorGraph
from src.maze import Maze, StimulusType
from src.feeding_maze_sim import FeedingMazeSimulator, GameState

ARTIFACTS_DIR = Path("artifacts/scototaxis")
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def create_shadow_vs_light_arena() -> Maze:
    """Experiment 1: Shadow zone on one side, bright zone on the other."""
    maze = Maze(
        width=500,
        height=300,
        name="Shadow vs Light Arena",
        time_limit=2000,
    )
    
    # Fly starts in center
    maze.fly_start_x = 250
    maze.fly_start_y = 150
    maze.fly_start_theta = np.pi / 4  # Facing diagonal
    
    # Shadow zone on LEFT side
    maze.add_stimulus(StimulusType.SHADOW, 100, 150, intensity=1.5, sigma=80)
    
    # Light zone on RIGHT side
    maze.add_stimulus(StimulusType.LIGHT, 400, 150, intensity=1.5, sigma=80)
    
    return maze


def create_corridor_choice() -> Maze:
    """Experiment 2: Corridor splits into lit vs dark paths."""
    maze = Maze(
        width=600,
        height=300,
        name="Lit vs Dark Corridor",
        time_limit=2000,
    )
    
    # Fly starts on left
    maze.fly_start_x = 50
    maze.fly_start_y = 150
    maze.fly_start_theta = 0  # Facing right
    
    # Central wall splits path
    maze.add_wall(200, 110, 200, 80)
    
    # Top path = DARK (shadow)
    maze.add_stimulus(StimulusType.SHADOW, 300, 250, intensity=1.5, sigma=60)
    
    # Bottom path = BRIGHT (light)
    maze.add_stimulus(StimulusType.LIGHT, 300, 50, intensity=1.5, sigma=60)
    
    # Both paths have same fruit at end (to control for chemotaxis)
    maze.add_stimulus(StimulusType.FRUIT, 550, 220, intensity=0.8, sigma=40)
    maze.add_stimulus(StimulusType.FRUIT, 550, 80, intensity=0.8, sigma=40)
    
    return maze


def create_conflict_arena() -> Maze:
    """Experiment 3: Fruit in bright zone vs empty shadow zone."""
    maze = Maze(
        width=500,
        height=300,
        name="Fruit in Light vs Empty Shadow",
        time_limit=2000,
    )
    
    # Fly starts in center
    maze.fly_start_x = 250
    maze.fly_start_y = 150
    maze.fly_start_theta = 0
    
    # Fruit + LIGHT on RIGHT (smell good but bright)
    maze.add_stimulus(StimulusType.FRUIT, 400, 150, intensity=1.0, sigma=60)
    maze.add_stimulus(StimulusType.LIGHT, 400, 150, intensity=1.2, sigma=80)
    
    # Shadow on LEFT (no food but dark)
    maze.add_stimulus(StimulusType.SHADOW, 100, 150, intensity=1.2, sigma=80)
    
    return maze


def run_experiment(
    graph: VisualMotorGraph,
    maze: Maze,
    name: str,
    seeds: list = [42, 123, 456, 789, 1234],
    max_steps: int = 1500,
):
    """Run experiment with multiple seeds and collect metrics."""
    results = []
    all_paths = []
    
    print(f"\n=== {name} ===")
    
    for seed in seeds:
        sim = FeedingMazeSimulator(
            graph=graph,
            maze=maze,
            seed=seed,
            odor_current=5.0,
            starve_time_steps=5000,  # No starvation pressure for this test
        )
        
        # Run simulation
        state = sim.run_until_done(max_steps=max_steps)
        
        # Collect path
        path_x = np.array(sim.path_x)
        path_y = np.array(sim.path_y)
        all_paths.append((path_x, path_y))
        
        # Compute metrics
        shadow_time = 0
        light_time = 0
        
        # Check if position is in shadow/light zones
        for i, (x, y) in enumerate(zip(path_x, path_y)):
            for stim in maze.stimuli:
                dist = np.sqrt((x - stim.x)**2 + (y - stim.y)**2)
                if dist < stim.sigma:
                    if stim.type == StimulusType.SHADOW:
                        shadow_time += 1
                    elif stim.type == StimulusType.LIGHT:
                        light_time += 1
        
        # Mean position
        mean_x = np.mean(path_x[len(path_x)//2:])  # Second half of run
        
        result = {
            "seed": seed,
            "steps": sim.state.step,
            "shadow_time": shadow_time,
            "light_time": light_time,
            "shadow_ratio": shadow_time / (shadow_time + light_time + 1),
            "mean_x": mean_x,
            "final_x": path_x[-1],
            "final_y": path_y[-1],
        }
        results.append(result)
        
        print(f"  Seed {seed}: shadow={shadow_time}, light={light_time}, mean_x={mean_x:.1f}")
    
    # Aggregate
    mean_shadow_ratio = np.mean([r["shadow_ratio"] for r in results])
    mean_shadow_time = np.mean([r["shadow_time"] for r in results])
    mean_light_time = np.mean([r["light_time"] for r in results])
    
    print(f"\n  AGGREGATE: shadow_ratio={mean_shadow_ratio:.2%}")
    print(f"             shadow_time={mean_shadow_time:.0f}, light_time={mean_light_time:.0f}")
    
    # Plot paths
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Draw arena
    ax.set_xlim(0, maze.width)
    ax.set_ylim(0, maze.height)
    ax.set_aspect('equal')
    
    # Draw stimuli
    for stim in maze.stimuli:
        if stim.type == StimulusType.SHADOW:
            circle = plt.Circle((stim.x, stim.y), stim.sigma, 
                               color='gray', alpha=0.3, label='Shadow')
        elif stim.type == StimulusType.LIGHT:
            circle = plt.Circle((stim.x, stim.y), stim.sigma,
                               color='yellow', alpha=0.3, label='Light')
        elif stim.type == StimulusType.FRUIT:
            circle = plt.Circle((stim.x, stim.y), stim.sigma,
                               color='green', alpha=0.3, label='Fruit')
        ax.add_patch(circle)
    
    # Draw walls
    for wall in maze.walls:
        rect = plt.Rectangle((wall.x, wall.y), wall.width, wall.height,
                            color='brown', alpha=0.5)
        ax.add_patch(rect)
    
    # Draw paths
    colors = plt.cm.viridis(np.linspace(0, 1, len(all_paths)))
    for i, (px, py) in enumerate(all_paths):
        ax.plot(px, py, color=colors[i], alpha=0.7, linewidth=1, label=f'seed {seeds[i]}')
        ax.scatter(px[0], py[0], color=colors[i], marker='o', s=50)  # Start
        ax.scatter(px[-1], py[-1], color=colors[i], marker='x', s=50)  # End
    
    ax.set_title(f"{name}\nShadow ratio: {mean_shadow_ratio:.1%}")
    ax.legend(loc='upper left', fontsize=8)
    
    fig.tight_layout()
    fig.savefig(ARTIFACTS_DIR / f"{name.replace(' ', '_').lower()}.png", dpi=150)
    plt.close(fig)
    
    return results


def main():
    print("=== SCOTOTAXIS (SHADOW PREFERENCE) SPIKE TEST ===")
    print("Testing AOTU→DNa02/DNa03 pure-graph pathway")
    print()
    
    # Load graph with visual_motor subgraph (includes AOTU)
    print("Loading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    # Count AOTU neurons in subgraph
    from src.landing_feeding import AOTU_LEFT, AOTU_RIGHT
    aotu_l_in = sum(1 for b in AOTU_LEFT if b in graph.body_to_idx)
    aotu_r_in = sum(1 for b in AOTU_RIGHT if b in graph.body_to_idx)
    print(f"AOTU neurons in subgraph: L={aotu_l_in}, R={aotu_r_in}")
    
    all_results = {}
    
    # Experiment 1: Shadow vs Light arena
    print("\n" + "="*60)
    maze1 = create_shadow_vs_light_arena()
    results1 = run_experiment(graph, maze1, "Exp1 Shadow vs Light Arena")
    all_results["shadow_vs_light"] = results1
    
    # Experiment 2: Corridor choice
    print("\n" + "="*60)
    maze2 = create_corridor_choice()
    results2 = run_experiment(graph, maze2, "Exp2 Corridor Choice")
    all_results["corridor_choice"] = results2
    
    # Experiment 3: Conflict (fruit in light vs empty shadow)
    print("\n" + "="*60)
    maze3 = create_conflict_arena()
    results3 = run_experiment(graph, maze3, "Exp3 Fruit in Light vs Shadow")
    all_results["conflict"] = results3
    
    # Summary
    print("\n" + "="*60)
    print("=== SUMMARY ===")
    print()
    
    for name, results in all_results.items():
        mean_ratio = np.mean([r["shadow_ratio"] for r in results])
        print(f"{name}: shadow_ratio = {mean_ratio:.1%}")
    
    # Save results
    with open(ARTIFACTS_DIR / "scototaxis_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    
    print(f"\nArtifacts saved to {ARTIFACTS_DIR}")
    
    # Interpret results
    print("\n=== INTERPRETATION ===")
    
    exp1_ratio = np.mean([r["shadow_ratio"] for r in all_results["shadow_vs_light"]])
    if exp1_ratio > 0.6:
        print("✅ Exp1: Fly shows SHADOW PREFERENCE (scototaxis)")
    elif exp1_ratio > 0.4:
        print("⚠️ Exp1: Mixed behavior (weak scototaxis)")
    else:
        print("❌ Exp1: Fly shows LIGHT PREFERENCE (opposite of expected)")
    
    exp3_ratio = np.mean([r["shadow_ratio"] for r in all_results["conflict"]])
    if exp3_ratio < 0.4:
        print("✅ Exp3: FRUIT ODOR beats scototaxis (chemotaxis dominant)")
    elif exp3_ratio > 0.6:
        print("⚠️ Exp3: SCOTOTAXIS beats chemotaxis (shadow dominates over food)")
    else:
        print("⚠️ Exp3: Mixed/conflict behavior")


if __name__ == "__main__":
    main()
