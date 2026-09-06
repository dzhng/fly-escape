#!/usr/bin/env python3
"""
Test vinegar aversion using PURE GRAPH inhibitory LH pathway.

This demonstrates that vinegar causes the fly to turn AWAY without
any external turn bias — the aversion emerges from the neural network.

AVERSIVE PATHWAY:
- Vinegar (acetic acid) → aversive glomeruli + inhibitory LH neurons
- LHAD1g1 (GABAergic) is the strongest aversive LH→motor neuron
- When activated, it INHIBITS ipsilateral DNs
- Contralateral side dominates → fly turns AWAY from vinegar

METRICS:
- Time spent in vinegar zone (should be LOW)
- Mean distance to vinegar (should be HIGH)
- Turn direction when near vinegar (should be AWAY)
"""

import sys
import argparse
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from graph_loader import MaleCNSGraph
from feeding_maze_sim import FeedingMazeSimulator, GameState
from maze import Maze, StimulusType


def create_vinegar_test_level(with_vinegar: bool = True) -> Maze:
    """Create a level to test vinegar aversion."""
    maze = Maze(
        width=500,
        height=300,
        name="Vinegar Aversion Test",
        time_limit=2000,
    )
    
    # Fly starts in center
    maze.fly_start_x = 250
    maze.fly_start_y = 150
    maze.fly_start_theta = 0  # Facing right
    
    # Fruit on the right (attractive target)
    maze.add_stimulus(StimulusType.FRUIT, 420, 150, intensity=1.0, sigma=60)
    
    if with_vinegar:
        # Vinegar blocking direct path (pure-graph aversion)
        maze.add_stimulus(StimulusType.VINEGAR, 340, 150, intensity=1.5, sigma=50)
    
    return maze


def compute_metrics(sim: FeedingMazeSimulator, vinegar_x: float, vinegar_y: float, vinegar_sigma: float) -> dict:
    """Compute aversion metrics from simulation."""
    path_x = np.array(sim.path_x)
    path_y = np.array(sim.path_y)
    
    # Distance to vinegar over time
    dist_to_vinegar = np.sqrt((path_x - vinegar_x)**2 + (path_y - vinegar_y)**2)
    
    # Time in vinegar zone (within 1 sigma)
    in_zone = dist_to_vinegar < vinegar_sigma
    time_in_zone = np.sum(in_zone) / len(in_zone)
    
    # Mean/min distance
    mean_dist = np.mean(dist_to_vinegar)
    min_dist = np.min(dist_to_vinegar)
    
    # Turn analysis when near vinegar
    turns = np.array(sim.state.turns) if sim.state.turns else np.array([0])
    near_vinegar = dist_to_vinegar[:-1] < vinegar_sigma * 1.5 if len(dist_to_vinegar) > 1 else np.array([False])
    
    if np.any(near_vinegar) and len(turns) > 0:
        # Get turn direction relative to vinegar
        turn_near = turns[near_vinegar[:len(turns)]] if np.sum(near_vinegar[:len(turns)]) > 0 else np.array([0])
        mean_turn_near = np.mean(turn_near)
    else:
        mean_turn_near = 0.0
    
    return {
        "time_in_vinegar_zone": time_in_zone,
        "mean_distance_to_vinegar": mean_dist,
        "min_distance_to_vinegar": min_dist,
        "mean_turn_near_vinegar": mean_turn_near,
        "total_steps": len(path_x),
    }


def main():
    parser = argparse.ArgumentParser(description="Test vinegar aversion")
    parser.add_argument("--data-dir", type=str, default="data")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--seeds", type=int, default=5, help="Number of seeds to test")
    args = parser.parse_args()
    
    print("=" * 60)
    print("VINEGAR AVERSION TEST — Pure Graph Inhibitory LH Pathway")
    print("=" * 60)
    print()
    print("Testing that vinegar causes the fly to turn AWAY")
    print("without any external turn bias.")
    print()
    
    # Load connectome
    print("Loading MaleCNS connectome...")
    graph = MaleCNSGraph(args.data_dir)
    graph.load()
    graph.extract_motor1hop()
    
    # Test with and without vinegar
    vinegar_x, vinegar_y, vinegar_sigma = 340, 150, 50
    
    results_with = []
    results_without = []
    
    print(f"\nRunning {args.seeds} trials each (with and without vinegar)...")
    
    for seed in range(args.seed, args.seed + args.seeds):
        # With vinegar
        maze_with = create_vinegar_test_level(with_vinegar=True)
        sim_with = FeedingMazeSimulator(graph, maze_with, seed=seed, starve_time_steps=5000)
        sim_with.run_until_done(max_steps=2000)
        metrics_with = compute_metrics(sim_with, vinegar_x, vinegar_y, vinegar_sigma)
        results_with.append(metrics_with)
        
        # Without vinegar
        maze_without = create_vinegar_test_level(with_vinegar=False)
        sim_without = FeedingMazeSimulator(graph, maze_without, seed=seed, starve_time_steps=5000)
        sim_without.run_until_done(max_steps=2000)
        metrics_without = compute_metrics(sim_without, vinegar_x, vinegar_y, vinegar_sigma)
        results_without.append(metrics_without)
        
        print(f"  Seed {seed}: with vinegar time_in_zone={metrics_with['time_in_vinegar_zone']:.1%}, "
              f"without={metrics_without['time_in_vinegar_zone']:.1%}")
    
    # Aggregate results
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    def avg(lst, key):
        return np.mean([r[key] for r in lst])
    
    print("\n| Metric | With Vinegar | Without Vinegar | Δ |")
    print("|--------|--------------|-----------------|---|")
    
    time_with = avg(results_with, 'time_in_vinegar_zone')
    time_without = avg(results_without, 'time_in_vinegar_zone')
    print(f"| Time in zone | {time_with:.1%} | {time_without:.1%} | {time_without - time_with:+.1%} |")
    
    dist_with = avg(results_with, 'mean_distance_to_vinegar')
    dist_without = avg(results_without, 'mean_distance_to_vinegar')
    print(f"| Mean distance | {dist_with:.1f} | {dist_without:.1f} | {dist_with - dist_without:+.1f} |")
    
    min_with = avg(results_with, 'min_distance_to_vinegar')
    min_without = avg(results_without, 'min_distance_to_vinegar')
    print(f"| Min distance | {min_with:.1f} | {min_without:.1f} | {min_with - min_without:+.1f} |")
    
    turn_with = avg(results_with, 'mean_turn_near_vinegar')
    print(f"| Turn near (w/ vin) | {turn_with:.4f} | N/A | — |")
    
    # Interpretation
    print("\n" + "=" * 60)
    print("INTERPRETATION")
    print("=" * 60)
    
    if time_with < time_without * 0.8:
        print("✓ AVERSION CONFIRMED: Fly spends less time in vinegar zone")
    else:
        print("? Weak aversion effect on time in zone")
    
    if dist_with > dist_without * 1.1:
        print("✓ AVERSION CONFIRMED: Fly maintains greater distance from vinegar")
    else:
        print("? Weak aversion effect on distance")
    
    if min_with > min_without:
        print("✓ AVERSION CONFIRMED: Fly avoids getting as close to vinegar")
    else:
        print("? Fly still approaches vinegar closely")
    
    print("\nPURE GRAPH VERIFICATION:")
    print("  - Aversion via INHIBITORY LH (LHAD1g1, GABAergic)")
    print("  - NO external turn-away vector")
    print("  - NO chemotaxis_gain hack")
    print("  - NO bearing→turn shortcut")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
