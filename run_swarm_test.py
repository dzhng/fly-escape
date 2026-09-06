#!/usr/bin/env python3
"""
Swarm test for house escape level.
Runs N flies and reports escape rates.
"""

import sys
import time
import argparse
import numpy as np
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

sys.path.insert(0, str(Path(__file__).parent / "src"))

from graph_loader import load_visual_motor
from feeding_maze_sim import FeedingMazeSimulator, GameState
from house_level import create_house_escape_level, create_minimal_house_level

DATA_DIR = Path(__file__).parent / "data"


def run_single_fly(args):
    """Run a single fly simulation and return results."""
    seed, maze, graph, max_steps = args
    
    sim = FeedingMazeSimulator(maze=maze, graph=graph, seed=seed)
    sim.reset()
    
    min_dist_to_exit = float('inf')
    exit_pos = (maze.jar.x, maze.jar.y) if maze.jar else (0, 0)
    
    for step in range(max_steps):
        result = sim.step()
        
        # Track distance to exit via simulator properties
        fly_x, fly_y = sim.x, sim.y
        dist = np.sqrt((fly_x - exit_pos[0])**2 + (fly_y - exit_pos[1])**2)
        min_dist_to_exit = min(min_dist_to_exit, dist)
        
        # Check termination via GameState
        if result == GameState.WON:
            return {
                'seed': seed,
                'outcome': 'ESCAPED',
                'steps': step + 1,
                'min_dist': min_dist_to_exit,
                'takeoffs': sim.state.total_takeoffs,
            }
        if result == GameState.STARVED:
            return {
                'seed': seed,
                'outcome': 'STARVED',
                'steps': step + 1,
                'min_dist': min_dist_to_exit,
                'takeoffs': sim.state.total_takeoffs,
            }
        if result == GameState.ZAPPED:
            return {
                'seed': seed,
                'outcome': 'ZAPPED',
                'steps': step + 1,
                'min_dist': min_dist_to_exit,
                'takeoffs': sim.state.total_takeoffs,
            }
    
    return {
        'seed': seed,
        'outcome': 'TIMEOUT',
        'steps': max_steps,
        'min_dist': min_dist_to_exit,
        'takeoffs': sim.state.total_takeoffs,
    }


def run_swarm_sequential(n_flies, maze, graph, max_steps, base_seed=42):
    """Run swarm sequentially (for debugging)."""
    results = []
    for i in range(n_flies):
        seed = base_seed + i
        args = (seed, maze, graph, max_steps)
        result = run_single_fly(args)
        results.append(result)
        print(f"  Fly {i+1}/{n_flies}: {result['outcome']} in {result['steps']} steps, "
              f"min_dist={result['min_dist']:.0f}, takeoffs={result['takeoffs']}")
    return results


def main():
    parser = argparse.ArgumentParser(description='Swarm test for house escape')
    parser.add_argument('--n-flies', type=int, default=5, help='Number of flies')
    parser.add_argument('--max-steps', type=int, default=1500, help='Max steps per fly')
    parser.add_argument('--level', choices=['full', 'minimal'], default='minimal', help='Level type')
    parser.add_argument('--seed', type=int, default=42, help='Base seed')
    parser.add_argument('--zappers', action='store_true', help='Include fly zappers')
    parser.add_argument('--n-zappers', type=int, default=2, help='Number of zappers')
    args = parser.parse_args()
    
    print("=" * 60)
    print(f"SWARM TEST: N={args.n_flies} flies, {args.level} level")
    print("=" * 60)
    
    # Load graph once
    print("\nLoading graph...")
    start = time.perf_counter()
    graph = load_visual_motor(DATA_DIR)
    print(f"Graph loaded in {time.perf_counter() - start:.1f}s")
    
    # Create maze
    zapper_str = f" with {args.n_zappers} zappers" if args.zappers else ""
    print(f"\nCreating {args.level} house level{zapper_str}...")
    if args.level == 'full':
        maze = create_house_escape_level(
            include_toolkit=True, include_threat=True,
            include_zappers=args.zappers, n_zappers=args.n_zappers
        )
    else:
        maze = create_minimal_house_level(
            include_zappers=args.zappers, n_zappers=args.n_zappers
        )
    
    print(f"  Walls: {len(maze.walls)}")
    print(f"  Stimuli: {len(maze.stimuli)}")
    
    # Run swarm
    print(f"\nRunning {args.n_flies} flies (max {args.max_steps} steps each)...")
    start = time.perf_counter()
    
    results = run_swarm_sequential(args.n_flies, maze, graph, args.max_steps, args.seed)
    
    elapsed = time.perf_counter() - start
    
    # Analyze results
    escaped = sum(1 for r in results if r['outcome'] == 'ESCAPED')
    starved = sum(1 for r in results if r['outcome'] == 'STARVED')
    zapped = sum(1 for r in results if r['outcome'] == 'ZAPPED')
    timeout = sum(1 for r in results if r['outcome'] == 'TIMEOUT')
    
    escape_rate = escaped / len(results) * 100
    
    # Star rating
    if escape_rate >= 75:
        stars = "⭐⭐⭐"
    elif escape_rate >= 50:
        stars = "⭐⭐"
    elif escape_rate >= 25:
        stars = "⭐"
    else:
        stars = "no stars"
    
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"\n  Escaped: {escaped}/{args.n_flies} ({escape_rate:.0f}%) → {stars}")
    print(f"  Starved: {starved}/{args.n_flies}")
    print(f"  Zapped:  {zapped}/{args.n_flies}")
    print(f"  Timeout: {timeout}/{args.n_flies}")
    
    avg_steps = np.mean([r['steps'] for r in results if r['outcome'] == 'ESCAPED']) if escaped > 0 else 0
    avg_min_dist = np.mean([r['min_dist'] for r in results])
    avg_takeoffs = np.mean([r['takeoffs'] for r in results])
    
    print(f"\n  Avg steps to escape: {avg_steps:.0f}")
    print(f"  Avg min distance to exit: {avg_min_dist:.0f}")
    print(f"  Avg takeoffs: {avg_takeoffs:.1f}")
    print(f"\n  Total time: {elapsed:.1f}s ({elapsed/args.n_flies:.2f}s per fly)")
    
    # Detailed table
    print("\n### Individual Results ###")
    print(f"{'Seed':<8} {'Outcome':<10} {'Steps':<8} {'Min Dist':<10} {'Takeoffs':<10}")
    print("-" * 50)
    for r in results:
        print(f"{r['seed']:<8} {r['outcome']:<10} {r['steps']:<8} {r['min_dist']:<10.0f} {r['takeoffs']:<10}")
    
    return results


if __name__ == "__main__":
    results = main()
