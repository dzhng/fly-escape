#!/usr/bin/env python3
"""
Help the Fly Escape — Multi-room house level test.

Runs the first real "Help the Fly Escape" level with:
- 3-4 rooms between spawn and orange glowing exit
- Mixed obstacle rooms (shadow, light, attract, repel)
- Exit zone with near-field magnet
- Threat for takeoff boost
- Swarm-ready: multiple seeds for probabilistic scoring

Metrics:
- Reach-exit rate (escape success)
- Takeoff events (walk-vs-fly)
- Starve rate
"""

import sys
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import json
from collections import Counter

sys.path.insert(0, str(Path(__file__).parent / "src"))
sys.path.insert(0, str(Path(__file__).parent))

from graph_loader import VisualMotorGraph
from feeding_maze_sim import FeedingMazeSimulator, GameState
from house_level import create_house_escape_level, create_minimal_house_level


def run_single_fly(
    graph,
    maze,
    seed: int,
    max_steps: int,
    label: str = "",
) -> dict:
    """Run single fly and collect metrics."""
    sim = FeedingMazeSimulator(
        graph=graph,
        maze=maze,
        seed=seed,
    )
    sim.reset(new_seed=seed)
    
    # Track history
    modes = []
    dists_to_exit = []
    
    exit_x = 1100  # From house level
    exit_y = 200
    
    for step in range(max_steps):
        state = sim.step()
        
        modes.append(sim.flight.mode.value)
        dist = np.sqrt((sim.x - exit_x) ** 2 + (sim.y - exit_y) ** 2)
        dists_to_exit.append(dist)
        
        # Win = reach exit (jar in our case)
        if state == GameState.WON:
            break
        if state == GameState.STARVED:
            break
    
    metrics = sim.get_metrics()
    metrics["seed"] = seed
    metrics["label"] = label
    metrics["escaped"] = (sim.state.game_state == GameState.WON)
    metrics["starved"] = (sim.state.game_state == GameState.STARVED)
    metrics["modes"] = modes
    metrics["dists_to_exit"] = dists_to_exit
    metrics["path_x"] = sim.path_x.copy()
    metrics["path_y"] = sim.path_y.copy()
    metrics["min_dist_to_exit"] = min(dists_to_exit) if dists_to_exit else float('inf')
    
    return metrics


def run_swarm(
    graph,
    maze,
    seeds: list,
    max_steps: int,
) -> list:
    """Run swarm of flies and collect all metrics."""
    results = []
    for i, seed in enumerate(seeds):
        print(f"  Fly {i+1}/{len(seeds)} (seed {seed})...", end=" ", flush=True)
        metrics = run_single_fly(graph, maze, seed, max_steps, label=f"fly_{seed}")
        outcome = "ESCAPED" if metrics["escaped"] else ("STARVED" if metrics["starved"] else "running")
        print(f"{outcome} at step {metrics['total_steps']}, "
              f"min_dist={metrics['min_dist_to_exit']:.0f}, "
              f"takeoffs={metrics['total_takeoffs']}")
        results.append(metrics)
    return results


def plot_swarm_results(results: list, maze, out_path: Path):
    """Create visualization of swarm results."""
    fig = plt.figure(figsize=(16, 12))
    
    # 1. All paths overlay
    ax1 = fig.add_subplot(2, 2, 1)
    
    # Draw walls (simplified)
    for wall in maze.walls:
        rect = plt.Rectangle((wall.x, wall.y), wall.width, wall.height,
                             facecolor='gray', edgecolor='black', alpha=0.5)
        ax1.add_patch(rect)
    
    # Draw stimuli
    for stim in maze.stimuli:
        if stim.type.value == 'exit':
            # Orange glow for exit
            circle = plt.Circle((stim.x, stim.y), stim.sigma, 
                               facecolor='orange', edgecolor='darkorange', 
                               alpha=0.3, linewidth=2)
            ax1.add_patch(circle)
            ax1.plot(stim.x, stim.y, 'o', color='orange', markersize=15, 
                    markeredgecolor='darkorange', markeredgewidth=2)
        elif stim.type.value == 'shadow':
            circle = plt.Circle((stim.x, stim.y), stim.sigma,
                               facecolor='darkgray', alpha=0.2)
            ax1.add_patch(circle)
        elif stim.type.value == 'light':
            circle = plt.Circle((stim.x, stim.y), stim.sigma,
                               facecolor='yellow', alpha=0.2)
            ax1.add_patch(circle)
        elif stim.type.value == 'fruit':
            ax1.plot(stim.x, stim.y, '*', color='green', markersize=10)
        elif stim.type.value == 'threat':
            ax1.plot(stim.x, stim.y, 'X', color='red', markersize=12)
        elif stim.type.value == 'vinegar':
            ax1.plot(stim.x, stim.y, 's', color='purple', markersize=8)
    
    # Draw paths
    for r in results:
        color = 'green' if r['escaped'] else ('red' if r['starved'] else 'blue')
        alpha = 0.6 if r['escaped'] else 0.3
        ax1.plot(r['path_x'], r['path_y'], '-', color=color, alpha=alpha, linewidth=1)
    
    # Start point
    ax1.plot(maze.fly_start_x, maze.fly_start_y, 'ko', markersize=10, label='Start')
    
    ax1.set_xlim(0, maze.width)
    ax1.set_ylim(0, maze.height)
    ax1.set_aspect('equal')
    ax1.set_title('All Fly Paths (green=escaped, red=starved)')
    
    # 2. Distance to exit over time
    ax2 = fig.add_subplot(2, 2, 2)
    for r in results:
        color = 'green' if r['escaped'] else ('red' if r['starved'] else 'gray')
        ax2.plot(r['dists_to_exit'], color=color, alpha=0.5)
    ax2.axhline(60, color='orange', linestyle='--', label='Exit near-field')
    ax2.set_xlabel('Step')
    ax2.set_ylabel('Distance to Exit')
    ax2.set_title('Distance to Exit over Time')
    ax2.legend()
    
    # 3. Mode breakdown (walking vs flying)
    ax3 = fig.add_subplot(2, 2, 3)
    walk_ratios = []
    fly_ratios = []
    for r in results:
        if r['modes']:
            mode_counts = Counter(r['modes'])
            total = len(r['modes'])
            walk_ratios.append(mode_counts.get('walking', 0) / total)
            fly_ratios.append(mode_counts.get('flying', 0) / total)
    
    x = range(len(results))
    ax3.bar(x, fly_ratios, label='Flying', color='skyblue')
    ax3.bar(x, walk_ratios, bottom=fly_ratios, label='Walking', color='brown')
    ax3.set_xlabel('Fly #')
    ax3.set_ylabel('Time Ratio')
    ax3.set_title('Walk vs Fly Time per Fly')
    ax3.legend()
    
    # 4. Summary stats
    ax4 = fig.add_subplot(2, 2, 4)
    ax4.axis('off')
    
    escaped = sum(1 for r in results if r['escaped'])
    starved = sum(1 for r in results if r['starved'])
    running = len(results) - escaped - starved
    total_takeoffs = sum(r['total_takeoffs'] for r in results)
    avg_min_dist = np.mean([r['min_dist_to_exit'] for r in results])
    
    # Star rating
    escape_rate = escaped / len(results)
    stars = "⭐" if escape_rate >= 0.25 else ""
    stars += "⭐" if escape_rate >= 0.50 else ""
    stars += "⭐" if escape_rate >= 0.75 else ""
    
    summary_text = f"""
SWARM RESULTS ({len(results)} flies)
═══════════════════════════════════

OUTCOMES:
  Escaped:  {escaped}/{len(results)} ({escape_rate:.0%})
  Starved:  {starved}/{len(results)} ({starved/len(results):.0%})
  Running:  {running}/{len(results)}

RATING: {stars if stars else '(no stars)'}
  ⭐ = 25%+   ⭐⭐ = 50%+   ⭐⭐⭐ = 75%+

LOCOMOTION:
  Total takeoffs: {total_takeoffs}
  Avg takeoffs/fly: {total_takeoffs/len(results):.1f}
  Avg walk ratio: {np.mean(walk_ratios):.0%}
  Avg fly ratio: {np.mean(fly_ratios):.0%}

NAVIGATION:
  Avg min dist to exit: {avg_min_dist:.0f}
"""
    ax4.text(0.1, 0.9, summary_text, transform=ax4.transAxes,
             fontsize=11, verticalalignment='top', fontfamily='monospace')
    
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    print(f"Saved: {out_path}")


def main():
    print("=" * 60)
    print("Help the Fly Escape — Multi-Room House Level")
    print("=" * 60)
    
    # Load graph
    print("\nLoading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    # Create output directory
    out_dir = Path("artifacts/house_escape")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Use minimal level for faster testing
    print("\nCreating minimal house escape level...")
    maze = create_minimal_house_level()
    
    print(f"  Arena: {maze.width}x{maze.height}")
    print(f"  Walls: {len(maze.walls)}")
    print(f"  Stimuli: {len(maze.stimuli)}")
    for s in maze.stimuli:
        print(f"    {s.type.value}: ({s.x}, {s.y}) σ={s.sigma}")
    
    # Swarm parameters
    n_flies = 5  # Start small for testing
    seeds = list(range(42, 42 + n_flies))
    max_steps = 1500  # Enough for escape or starve
    
    print(f"\n" + "=" * 60)
    print(f"Running swarm: {n_flies} flies, {max_steps} max steps")
    print("=" * 60)
    
    results = run_swarm(graph, maze, seeds, max_steps)
    
    # Summary
    escaped = sum(1 for r in results if r['escaped'])
    starved = sum(1 for r in results if r['starved'])
    escape_rate = escaped / len(results)
    
    print(f"\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Escaped: {escaped}/{n_flies} ({escape_rate:.0%})")
    print(f"Starved: {starved}/{n_flies}")
    
    # Star rating
    stars = ""
    if escape_rate >= 0.25: stars += "⭐"
    if escape_rate >= 0.50: stars += "⭐"
    if escape_rate >= 0.75: stars += "⭐"
    print(f"Rating: {stars if stars else '(no stars)'}")
    
    # Plot
    print("\nGenerating visualization...")
    plot_swarm_results(results, maze, out_dir / "house_escape_swarm.png")
    
    # Save results JSON
    summary = {
        "level": "minimal_house_escape",
        "n_flies": n_flies,
        "max_steps": max_steps,
        "escaped": escaped,
        "starved": starved,
        "escape_rate": escape_rate,
        "stars": len(stars) if stars else 0,
        "results": [
            {
                "seed": r["seed"],
                "escaped": r["escaped"],
                "starved": r["starved"],
                "total_steps": r["total_steps"],
                "total_takeoffs": r["total_takeoffs"],
                "min_dist_to_exit": r["min_dist_to_exit"],
                "first_takeoff_step": r.get("first_takeoff_step"),
            }
            for r in results
        ]
    }
    
    with open(out_dir / "house_escape_results.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved: {out_dir / 'house_escape_results.json'}")
    
    plt.close()


if __name__ == "__main__":
    main()
