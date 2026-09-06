#!/usr/bin/env python3
"""
SPIKE: Walk-vs-Fly Level Proof

Creates a level where:
- Walk-only: Cannot reach fruit before 5-min starve
- Dual-mode: Can takeoff, fly to fruit, survive

This is the core mechanic of the walk-vs-fly economy.
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


def create_hard_level() -> Maze:
    """Create level where walking is too slow.
    
    Distance = 500 units
    Walk speed ≈ 1.0 unit/step (considering drag, chemotaxis wandering)
    Walk ETA ≈ 500-1500 steps (with exploration)
    
    Flight speed ≈ 3.5 units/step
    Flight ETA ≈ 150-300 steps
    
    Starve time = 3000 steps
    
    Walk-only: High risk of starving
    Dual-mode: Should survive via flight
    """
    maze = Maze(
        width=800, height=400,
        fly_start_x=100, fly_start_y=200,
        fly_start_theta=0,
    )
    
    # Fruit far away
    maze.stimuli.append(Stimulus(
        type=StimulusType.FRUIT,
        x=600,  # 500 units from start
        y=200,
        intensity=1.0,
        sigma=80.0,
    ))
    
    return maze


def run_simulation(
    graph,
    maze: Maze,
    max_steps: int,
    seed: int,
    allow_takeoff: bool,
    label: str,
) -> dict:
    """Run simulation and collect detailed metrics."""
    sim = FeedingMazeSimulator(
        graph=graph,
        maze=maze,
        seed=seed,
    )
    
    # Configure takeoff
    if not allow_takeoff:
        sim.landing_feeding.params.takeoff_hunger_threshold = 10.0
        sim.landing_feeding.params.takeoff_threat_gain = 0.0
    else:
        sim.landing_feeding.params.takeoff_hunger_threshold = 0.6
        sim.landing_feeding.params.takeoff_hunger_gain = 10.0
        sim.landing_feeding.params.takeoff_dn_threshold = 0.5
    
    sim.reset(new_seed=seed)
    
    # Track mode transitions
    mode_history = []
    dist_history = []
    hunger_history = []
    
    for step in range(max_steps):
        state = sim.step()
        
        # Record state
        mode = sim.flight.mode.value
        dist = np.sqrt((sim.x - 600) ** 2 + (sim.y - 200) ** 2)
        hunger = sim.landing_feeding.hunger.level
        
        mode_history.append(mode)
        dist_history.append(dist)
        hunger_history.append(hunger)
        
        # Print key events
        if step == 0:
            print(f"  [{label}] Start: mode={mode}, dist={dist:.0f}")
        
        # First takeoff
        if allow_takeoff and sim.state.first_takeoff_step == step:
            print(f"  [{label}] TAKEOFF at step {step}, hunger={hunger:.2f}")
        
        # First landing
        if sim.state.first_landing_step == step:
            print(f"  [{label}] LANDING at step {step}, dist={dist:.1f}")
        
        # First feed
        if sim.state.first_feeding_step == step:
            print(f"  [{label}] FEEDING at step {step}")
        
        # Check termination
        if state.value != "running":
            print(f"  [{label}] END at step {step}: {state.value}")
            break
    
    # Final metrics
    metrics = sim.get_metrics()
    metrics["seed"] = seed
    metrics["label"] = label
    metrics["allow_takeoff"] = allow_takeoff
    metrics["mode_history"] = mode_history
    metrics["dist_history"] = dist_history
    metrics["hunger_history"] = hunger_history
    metrics["path_x"] = sim.path_x.copy()
    metrics["path_y"] = sim.path_y.copy()
    
    return metrics


def main():
    print("=" * 60)
    print("SPIKE: Walk-vs-Fly Level Proof")
    print("=" * 60)
    print("Goal: Show walk-only fails, dual-mode survives")
    
    # Load graph
    print("\nLoading visual_motor subgraph...")
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    # Create output directory
    out_dir = Path("artifacts/walk_vs_fly")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Create hard level
    maze = create_hard_level()
    
    # Test parameters
    max_steps = 2500  # Less than starve time (3000) to catch early deaths
    seeds = [42, 43, 44]
    
    print("\n" + "=" * 60)
    print("LEVEL: Hard (fruit 500 units away)")
    print(f"Max steps: {max_steps}, Starve time: 3000 steps")
    print("=" * 60)
    
    walk_results = []
    dual_results = []
    
    for seed in seeds:
        print(f"\n--- Seed {seed} ---")
        
        # Walk-only
        r1 = run_simulation(graph, maze, max_steps, seed, False, f"WALK-{seed}")
        walk_results.append(r1)
        
        # Dual-mode
        r2 = run_simulation(graph, maze, max_steps, seed, True, f"DUAL-{seed}")
        dual_results.append(r2)
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    walk_fed = sum(1 for r in walk_results if r['total_feeds'] > 0)
    dual_fed = sum(1 for r in dual_results if r['total_feeds'] > 0)
    
    walk_survived = sum(1 for r in walk_results if r['final_state'] not in ['starved', 'dead'])
    dual_survived = sum(1 for r in dual_results if r['final_state'] not in ['starved', 'dead'])
    
    print(f"\nWalk-only: {walk_fed}/{len(seeds)} fed, {walk_survived}/{len(seeds)} survived")
    print(f"Dual-mode: {dual_fed}/{len(seeds)} fed, {dual_survived}/{len(seeds)} survived")
    
    # Plot comparison
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    
    # Paths
    ax = axes[0, 0]
    for r in walk_results:
        ax.plot(r['path_x'], r['path_y'], 'b-', alpha=0.5, linewidth=1)
    ax.scatter([100], [200], c='black', s=100, marker='o', zorder=5, label='Start')
    ax.scatter([600], [200], c='green', s=200, marker='*', zorder=5, label='Fruit')
    ax.set_xlim(0, 800)
    ax.set_ylim(0, 400)
    ax.set_title(f'Walk-only: {walk_fed}/{len(seeds)} fed')
    ax.set_aspect('equal')
    ax.legend(loc='upper right')
    
    ax = axes[0, 1]
    for r in dual_results:
        ax.plot(r['path_x'], r['path_y'], 'r-', alpha=0.5, linewidth=1)
    ax.scatter([100], [200], c='black', s=100, marker='o', zorder=5, label='Start')
    ax.scatter([600], [200], c='green', s=200, marker='*', zorder=5, label='Fruit')
    ax.set_xlim(0, 800)
    ax.set_ylim(0, 400)
    ax.set_title(f'Dual-mode: {dual_fed}/{len(seeds)} fed')
    ax.set_aspect('equal')
    ax.legend(loc='upper right')
    
    # Distance over time
    ax = axes[1, 0]
    for r in walk_results:
        ax.plot(r['dist_history'], 'b-', alpha=0.5)
    ax.axhline(30, color='g', linestyle='--', label='Landing distance')
    ax.set_xlabel('Step')
    ax.set_ylabel('Distance to fruit')
    ax.set_title('Walk-only: Distance over time')
    ax.legend()
    
    ax = axes[1, 1]
    for r in dual_results:
        ax.plot(r['dist_history'], 'r-', alpha=0.5)
    ax.axhline(30, color='g', linestyle='--', label='Landing distance')
    ax.set_xlabel('Step')
    ax.set_ylabel('Distance to fruit')
    ax.set_title('Dual-mode: Distance over time')
    ax.legend()
    
    plt.tight_layout()
    plt.savefig(out_dir / "walk_vs_fly_level_proof.png", dpi=150)
    print(f"\nSaved: {out_dir / 'walk_vs_fly_level_proof.png'}")
    
    # Save results
    summary = {
        "level": "hard_500_units",
        "max_steps": max_steps,
        "starve_time": 3000,
        "seeds": seeds,
        "walk_only": {
            "fed_count": walk_fed,
            "survived_count": walk_survived,
            "results": [
                {
                    "seed": r["seed"],
                    "final_state": r["final_state"],
                    "first_feed": r["first_feeding_step"],
                    "total_feeds": r["total_feeds"],
                    "steps": r["total_steps"],
                }
                for r in walk_results
            ]
        },
        "dual_mode": {
            "fed_count": dual_fed,
            "survived_count": dual_survived,
            "results": [
                {
                    "seed": r["seed"],
                    "final_state": r["final_state"],
                    "first_takeoff": r.get("first_takeoff_step"),
                    "first_feed": r["first_feeding_step"],
                    "total_feeds": r["total_feeds"],
                    "steps": r["total_steps"],
                }
                for r in dual_results
            ]
        },
    }
    
    with open(out_dir / "walk_vs_fly_level_proof.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved: {out_dir / 'walk_vs_fly_level_proof.json'}")
    
    # Spike findings
    print("\n" + "=" * 60)
    print("SPIKE FINDINGS: Walk-vs-Fly Level Proof")
    print("=" * 60)
    print(f"""
LEVEL DESIGN:
  - Distance to fruit: 500 units
  - Walk max speed: 1.2 units/step
  - Flight max speed: 4.0 units/step
  - Starve time: 3000 steps (5 minutes)

RESULTS:
  - Walk-only: {walk_fed}/{len(seeds)} fed, {walk_survived}/{len(seeds)} survived
  - Dual-mode: {dual_fed}/{len(seeds)} fed, {dual_survived}/{len(seeds)} survived

TAKEOFF MECHANISM:
  - Hunger > 0.6 → inject current to DNb01/DNb02
  - DNb01/DNb02 spike → takeoff triggered
  - Fly transitions from WALKING to FLYING

PURITY:
  ✅ DNb01/DNb02 are known flight-initiation neurons (Namiki et al.)
  ⚠️ Takeoff gate uses hunger threshold (soft, configurable)
  ⚠️ No pure-graph hunger → DN pathway (would need hunger state neurons)

GAME FEEL:
  - Walking is slow, precise, good for navigation
  - Flying is fast, overshoot, good for commuting
  - Hunger pressure forces takeoff on hard levels
""")
    
    plt.close()


if __name__ == "__main__":
    main()
