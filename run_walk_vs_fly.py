#!/usr/bin/env python3
"""
SPIKE: Walk-vs-Fly Economy

Demonstrates dual-mode locomotion:
1. WALKING: Slow (max 1.2), precise, high drag
2. FLYING: Fast (max 4.0), momentum, low drag

GOAL: Walking alone cannot beat hard layouts before the 5-min starve clock.
Flight is forced by hunger/threat → takeoff DNs (DNb01/DNb02).

Tests:
1. Walk-only (disable takeoff) → should STARVE on far-fruit layout
2. Dual-mode (enable takeoff) → should SURVIVE by flying to fruit
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
from maze import Maze, Wall, Stimulus, StimulusType, Jar
from landing_feeding import LandingFeedingParams


def create_far_fruit_arena(distance: float = 350.0) -> Maze:
    """Create arena with fruit far from start.
    
    At walk speed (1.2/step), reaching 350 units takes ~290 steps minimum.
    At flight speed (4.0/step), reaching 350 units takes ~90 steps minimum.
    
    Starve time = 3000 steps. But fly needs to locate fruit (not straight line).
    """
    maze = Maze(
        width=800, height=600,
        fly_start_x=100, fly_start_y=300,
        fly_start_theta=0,  # Facing right
    )
    
    # Fruit far away
    maze.stimuli.append(Stimulus(
        type=StimulusType.FRUIT,
        x=100 + distance,
        y=300,
        intensity=1.0,
        sigma=80.0,
    ))
    
    return maze


def create_very_far_fruit_arena() -> Maze:
    """Create arena where walk ETA >> starve time.
    
    Distance = 500. Walk speed = 1.2.
    Straight-line walk time = 500/1.2 = 416 steps (best case).
    But with wandering/exploration, actual time is 3-5x longer.
    
    If chemotaxis needs ~2000 steps to find fruit while walking,
    this exceeds 3000-step starve if no takeoff.
    """
    maze = Maze(
        width=1000, height=600,
        fly_start_x=100, fly_start_y=300,
        fly_start_theta=0,
    )
    
    # Fruit very far
    maze.stimuli.append(Stimulus(
        type=StimulusType.FRUIT,
        x=700,
        y=300,
        intensity=1.0,
        sigma=80.0,
    ))
    
    return maze


def run_test(
    graph,
    maze: Maze,
    max_steps: int,
    seed: int,
    allow_takeoff: bool = True,
    start_flying: bool = False,
) -> dict:
    """Run simulation with walk-vs-fly economy.
    
    Args:
        allow_takeoff: If False, disable takeoff (walk-only mode)
        start_flying: If True, start in flying mode
    """
    sim = FeedingMazeSimulator(
        graph=graph,
        maze=maze,
        seed=seed,
    )
    
    # Disable takeoff by setting very high threshold (after init)
    if not allow_takeoff:
        sim.landing_feeding.params.takeoff_hunger_threshold = 10.0  # Unreachable
        sim.landing_feeding.params.takeoff_threat_gain = 0.0
    
    # Reset with appropriate mode
    sim.reset(new_seed=seed, start_flying=start_flying)
    
    # Run simulation
    for step in range(max_steps):
        state = sim.step()
        if state.value != "running":
            break
    
    # Get metrics
    metrics = sim.get_metrics()
    metrics["seed"] = seed
    metrics["allow_takeoff"] = allow_takeoff
    metrics["start_flying"] = start_flying
    metrics["path_x"] = sim.path_x
    metrics["path_y"] = sim.path_y
    metrics["locomotion_modes"] = sim.state.locomotion_modes
    
    return metrics


def main():
    print("=" * 60)
    print("SPIKE: Walk-vs-Fly Economy")
    print("=" * 60)
    
    # Load graph
    print("\nLoading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    # Create output directory
    out_dir = Path("artifacts/walk_vs_fly")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Test parameters
    max_steps = 2500  # Less than starve time (3000) to see effect
    seeds = [42, 43, 44]
    
    print("\n" + "-" * 60)
    print("TEST 1: Medium distance (350 units)")
    print("-" * 60)
    
    maze = create_far_fruit_arena(distance=350)
    
    # Run walk-only (disable takeoff)
    print("\n1a. Walk-only mode (takeoff disabled)...")
    walk_only_results = []
    for seed in seeds:
        result = run_test(graph, maze, max_steps, seed, allow_takeoff=False)
        walk_only_results.append(result)
        print(f"  Seed {seed}: {result['final_state']}, "
              f"steps={result['total_steps']}, "
              f"first_feed={result['first_feeding_step']}, "
              f"takeoffs={result['total_takeoffs']}")
    
    # Run dual-mode (allow takeoff)
    print("\n1b. Dual mode (walk→fly enabled)...")
    dual_results = []
    for seed in seeds:
        result = run_test(graph, maze, max_steps, seed, allow_takeoff=True)
        dual_results.append(result)
        print(f"  Seed {seed}: {result['final_state']}, "
              f"steps={result['total_steps']}, "
              f"first_takeoff={result['first_takeoff_step']}, "
              f"first_feed={result['first_feeding_step']}, "
              f"takeoffs={result['total_takeoffs']}")
    
    print("\n" + "-" * 60)
    print("TEST 2: Very far distance (600 units)")
    print("-" * 60)
    
    maze_far = create_very_far_fruit_arena()
    
    # Run walk-only on very far layout
    print("\n2a. Walk-only on very far layout...")
    walk_far_results = []
    for seed in seeds:
        result = run_test(graph, maze_far, max_steps, seed, allow_takeoff=False)
        walk_far_results.append(result)
        print(f"  Seed {seed}: {result['final_state']}, "
              f"steps={result['total_steps']}, "
              f"first_feed={result['first_feeding_step']}")
    
    # Run dual-mode on very far layout
    print("\n2b. Dual mode on very far layout...")
    dual_far_results = []
    for seed in seeds:
        result = run_test(graph, maze_far, max_steps, seed, allow_takeoff=True)
        dual_far_results.append(result)
        print(f"  Seed {seed}: {result['final_state']}, "
              f"steps={result['total_steps']}, "
              f"first_takeoff={result['first_takeoff_step']}, "
              f"first_feed={result['first_feeding_step']}")
    
    # Plot comparison
    print("\n" + "-" * 60)
    print("Generating plots...")
    print("-" * 60)
    
    fig, axes = plt.subplots(2, 2, figsize=(14, 12))
    
    # Plot 1: Walk-only vs Dual (medium distance)
    ax = axes[0, 0]
    for result in walk_only_results[:2]:
        ax.plot(result['path_x'], result['path_y'], 'b-', alpha=0.5, 
                label='Walk-only' if result is walk_only_results[0] else '')
    for result in dual_results[:2]:
        ax.plot(result['path_x'], result['path_y'], 'r-', alpha=0.5,
                label='Dual mode' if result is dual_results[0] else '')
    # Mark fruit
    ax.scatter([450], [300], c='green', s=200, marker='*', zorder=5, label='Fruit')
    ax.scatter([100], [300], c='black', s=100, marker='o', zorder=5, label='Start')
    ax.set_xlim(0, 800)
    ax.set_ylim(0, 600)
    ax.set_title('Medium Distance (350 units)\nWalk-only (blue) vs Dual (red)')
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.legend(loc='upper right')
    ax.set_aspect('equal')
    
    # Plot 2: Walk-only vs Dual (very far)
    ax = axes[0, 1]
    for result in walk_far_results[:2]:
        ax.plot(result['path_x'], result['path_y'], 'b-', alpha=0.5,
                label='Walk-only' if result is walk_far_results[0] else '')
    for result in dual_far_results[:2]:
        ax.plot(result['path_x'], result['path_y'], 'r-', alpha=0.5,
                label='Dual mode' if result is dual_far_results[0] else '')
    # Mark fruit
    ax.scatter([700], [300], c='green', s=200, marker='*', zorder=5, label='Fruit')
    ax.scatter([100], [300], c='black', s=100, marker='o', zorder=5, label='Start')
    ax.set_xlim(0, 1000)
    ax.set_ylim(0, 600)
    ax.set_title('Very Far Distance (600 units)\nWalk-only (blue) vs Dual (red)')
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.legend(loc='upper right')
    ax.set_aspect('equal')
    
    # Plot 3: Mode timeline (dual mode, medium distance)
    ax = axes[1, 0]
    if dual_results:
        result = dual_results[0]
        modes = result.get('locomotion_modes', [])
        if modes:
            mode_values = [1 if m == 'flying' else 0 for m in modes]
            ax.fill_between(range(len(modes)), mode_values, alpha=0.5, color='red', label='Flying')
            ax.fill_between(range(len(modes)), [1 - v for v in mode_values], alpha=0.5, color='blue', label='Walking')
            ax.set_xlim(0, len(modes))
            ax.set_ylim(0, 1)
            ax.set_xlabel('Step')
            ax.set_ylabel('Mode')
            ax.set_title('Locomotion Mode Timeline (Dual Mode, Seed 42)')
            ax.legend(loc='upper right')
    
    # Plot 4: Summary metrics
    ax = axes[1, 1]
    categories = ['Walk-only\n(350)', 'Dual\n(350)', 'Walk-only\n(600)', 'Dual\n(600)']
    
    # Count survivals
    walk_med_survive = sum(1 for r in walk_only_results if r['final_state'] not in ['starved', 'dead'])
    dual_med_survive = sum(1 for r in dual_results if r['final_state'] not in ['starved', 'dead'])
    walk_far_survive = sum(1 for r in walk_far_results if r['final_state'] not in ['starved', 'dead'])
    dual_far_survive = sum(1 for r in dual_far_results if r['final_state'] not in ['starved', 'dead'])
    
    survived = [walk_med_survive, dual_med_survive, walk_far_survive, dual_far_survive]
    total = len(seeds)
    survival_rate = [s / total for s in survived]
    
    bars = ax.bar(categories, survival_rate, color=['blue', 'red', 'blue', 'red'], alpha=0.7)
    ax.set_ylabel('Survival Rate')
    ax.set_title(f'Survival Comparison ({total} seeds each)')
    ax.set_ylim(0, 1.1)
    
    # Add count labels
    for bar, count in zip(bars, survived):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02, 
                f'{count}/{total}', ha='center', va='bottom')
    
    plt.tight_layout()
    plt.savefig(out_dir / "walk_vs_fly_comparison.png", dpi=150)
    print(f"Saved: {out_dir / 'walk_vs_fly_comparison.png'}")
    
    # Save results JSON
    summary = {
        "test_params": {
            "max_steps": max_steps,
            "seeds": seeds,
            "medium_distance": 350,
            "far_distance": 600,
        },
        "results": {
            "walk_only_medium": [
                {"seed": r["seed"], "final_state": r["final_state"], 
                 "first_feed": r["first_feeding_step"], "steps": r["total_steps"]}
                for r in walk_only_results
            ],
            "dual_medium": [
                {"seed": r["seed"], "final_state": r["final_state"],
                 "first_takeoff": r["first_takeoff_step"],
                 "first_feed": r["first_feeding_step"], "steps": r["total_steps"]}
                for r in dual_results
            ],
            "walk_only_far": [
                {"seed": r["seed"], "final_state": r["final_state"],
                 "first_feed": r["first_feeding_step"], "steps": r["total_steps"]}
                for r in walk_far_results
            ],
            "dual_far": [
                {"seed": r["seed"], "final_state": r["final_state"],
                 "first_takeoff": r["first_takeoff_step"],
                 "first_feed": r["first_feeding_step"], "steps": r["total_steps"]}
                for r in dual_far_results
            ],
        },
        "survival_rates": {
            "walk_only_medium": walk_med_survive / total,
            "dual_medium": dual_med_survive / total,
            "walk_only_far": walk_far_survive / total,
            "dual_far": dual_far_survive / total,
        }
    }
    
    with open(out_dir / "walk_vs_fly_results.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved: {out_dir / 'walk_vs_fly_results.json'}")
    
    print("\n" + "=" * 60)
    print("SPIKE FINDINGS: Walk-vs-Fly Economy")
    print("=" * 60)
    print(f"""
DUAL KINEMATICS:
  - WALKING: max_speed=1.2, high drag, precise control
  - FLYING: max_speed=4.0, low drag, momentum-based

TAKEOFF GATES:
  - Hunger > 0.6 → inject DNb01/DNb02 (flight initiation)
  - Threat (escape loom) → also triggers takeoff
  - ⚠️ SOFT: Threshold-based on hunger level (not pure DN activity)

SURVIVAL RATES:
  - Walk-only (medium): {walk_med_survive}/{total} survived
  - Dual mode (medium): {dual_med_survive}/{total} survived
  - Walk-only (far): {walk_far_survive}/{total} survived
  - Dual mode (far): {dual_far_survive}/{total} survived

KEY FINDING: {"Dual mode improves survival on far layouts" if dual_far_survive > walk_far_survive else "Need to tune takeoff threshold"}
""")
    
    plt.close()


if __name__ == "__main__":
    main()
