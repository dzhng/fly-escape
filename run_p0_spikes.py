#!/usr/bin/env python3
"""
P0 SPIKES: Budget Economy + Zapper × Trail
==========================================

P0.2 - Budget Economy Dry-Run:
- Test whether puzzle depth exists with different budgets
- Price list for toolkit items
- Measure escape rate at different budget tiers

P0.3 - Zapper × Trail:
- Compare escape rate with zappers OFF vs ON (matched seeds)
- Determine if zappers are interesting detours or RNG death
"""

import sys
import argparse
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

import numpy as np
from graph_loader import load_visual_motor
from feeding_maze_sim import FeedingMazeSimulator, GameState
from maze import Maze, Wall, Stimulus, StimulusType, Jar

# =============================================================================
# PRICE LIST (P0.2)
# =============================================================================

PRICES = {
    'crumb': 10,        # Trail breadcrumb (cheap, essential)
    'fruit': 25,        # Landable fruit (more valuable)
    'shadow': 15,       # Shadow zone (scototaxis)
    'threat': 20,       # Takeoff trigger
    'vinegar': 15,      # Repellent
    'wind': 30,         # Physical push + advection (powerful)
    'light': 15,        # Light avoidance zone
}

# Budget tiers
BUDGETS = {
    'broke': 30,        # Can afford ~2-3 crumbs only
    'tight': 60,        # Can afford ~1 threat + 2-3 crumbs
    'medium': 120,      # Can afford decent trail
    'generous': 200,    # Can afford full toolkit
    'unlimited': 9999,  # No constraint
}


def create_budget_level(budget: int, width=800, height=350) -> Maze:
    """
    Create house level with budget-constrained toolkit placement.
    
    Layout: Simple 3-room with corridor
    ┌────────────────────────────────────────────────────────┐
    │  SPAWN     ROOM 1      CORRIDOR      EXIT ROOM   EXIT │
    │   ●═══════════════════════════════════════════════☀   │
    └────────────────────────────────────────────────────────┘
    """
    maze = Maze(
        width=width,
        height=height,
        fly_start_x=50,
        fly_start_y=175,
        fly_start_theta=0,
        time_limit=2000,
    )
    
    # Walls to create rooms (Wall uses x, y, width, height)
    wall_thickness = 10
    
    # Room 1 divider (partial wall)
    maze.walls.append(Wall(x=200, y=0, width=wall_thickness, height=120))
    maze.walls.append(Wall(x=200, y=230, width=wall_thickness, height=120))
    
    # Room 2 divider
    maze.walls.append(Wall(x=400, y=0, width=wall_thickness, height=120))
    maze.walls.append(Wall(x=400, y=230, width=wall_thickness, height=120))
    
    # Exit room entrance (partial wall creating baffle)
    maze.walls.append(Wall(x=600, y=0, width=wall_thickness, height=140))
    maze.walls.append(Wall(x=600, y=210, width=wall_thickness, height=140))
    
    # Exit baffle (blocks direct LOS to exit)
    maze.walls.append(Wall(x=650, y=140, width=wall_thickness, height=140))
    
    # Exit position
    exit_x = width - 40
    exit_y = height // 2
    
    # Exit stimulus (near-field magnet)
    maze.stimuli.append(Stimulus(
        type=StimulusType.EXIT,
        x=exit_x, y=exit_y,
        intensity=1.5, sigma=40,
    ))
    
    # Exit goal (jar as win zone)
    maze.jar = Jar(
        x=exit_x, y=exit_y,
        radius=30,
        opening_direction=np.pi,
        opening_width=0.85,
        has_bait=False,
    )
    
    # --- BUDGET-CONSTRAINED PLACEMENT ---
    spent = 0
    
    # Priority 1: Trail crumbs (most essential)
    crumb_positions = [
        (120, 175), (250, 175), (350, 175), (500, 175),
        (620, 175), (680, 120), (720, 175),
    ]
    for x, y in crumb_positions:
        if spent + PRICES['crumb'] <= budget:
            maze.stimuli.append(Stimulus(
                type=StimulusType.CRUMB,
                x=x, y=y, intensity=0.8, sigma=50,
            ))
            spent += PRICES['crumb']
    
    # Priority 2: Threat for takeoff (if budget allows)
    if spent + PRICES['threat'] <= budget:
        maze.stimuli.append(Stimulus(
            type=StimulusType.THREAT,
            x=30, y=175, intensity=1.0, sigma=60,
        ))
        spent += PRICES['threat']
    
    # Priority 3: Shadow zone (if budget allows)
    if spent + PRICES['shadow'] <= budget:
        maze.stimuli.append(Stimulus(
            type=StimulusType.SHADOW,
            x=300, y=175, intensity=1.0, sigma=70,
        ))
        spent += PRICES['shadow']
    
    # Priority 4: Extra fruit at exit approach (if budget allows)
    if spent + PRICES['fruit'] <= budget:
        maze.stimuli.append(Stimulus(
            type=StimulusType.FRUIT,
            x=700, y=175, intensity=1.2, sigma=40,
        ))
        spent += PRICES['fruit']
    
    return maze, spent


def create_zapper_level(include_zappers: bool, n_zappers: int = 3, seed: int = 12345) -> Maze:
    """
    Create house level with optional zappers for P0.3.
    """
    maze, _ = create_budget_level(budget=200)  # Generous budget
    
    if include_zappers:
        rng = np.random.default_rng(seed)
        
        # Zapper zones (off main path)
        zones = [
            (100, 180, 50, 120),   # Room 1 lower
            (250, 350, 50, 120),  # Corridor lower
            (500, 580, 220, 300), # Corridor upper
            (620, 700, 50, 120),  # Exit approach lower
        ]
        
        placed = 0
        for _ in range(50):
            if placed >= n_zappers:
                break
            zone = zones[rng.integers(len(zones))]
            x = rng.uniform(zone[0], zone[1])
            y = rng.uniform(zone[2], zone[3])
            
            # Avoid spawn and exit
            if np.sqrt((x - 50)**2 + (y - 175)**2) > 80:
                if np.sqrt((x - 760)**2 + (y - 175)**2) > 60:
                    maze.stimuli.append(Stimulus(
                        type=StimulusType.ZAPPER,
                        x=x, y=y,
                        intensity=1.0, sigma=20,
                    ))
                    placed += 1
    
    return maze


def run_single_fly(sim, max_steps: int) -> dict:
    """Run one fly and return outcome."""
    sim.reset()
    
    exit_x = 760
    exit_y = 175
    min_dist = float('inf')
    
    for step in range(max_steps):
        result = sim.step()
        
        dist = np.sqrt((sim.x - exit_x)**2 + (sim.y - exit_y)**2)
        min_dist = min(min_dist, dist)
        
        if result == GameState.WON:
            return {'outcome': 'ESCAPED', 'steps': step + 1, 'min_dist': min_dist}
        if result == GameState.STARVED:
            return {'outcome': 'STARVED', 'steps': step + 1, 'min_dist': min_dist}
        if result == GameState.ZAPPED:
            return {'outcome': 'ZAPPED', 'steps': step + 1, 'min_dist': min_dist}
    
    return {'outcome': 'TIMEOUT', 'steps': max_steps, 'min_dist': min_dist}


def run_swarm(graph, maze, n_flies: int, max_steps: int, base_seed: int) -> list:
    """Run swarm test."""
    results = []
    
    for i in range(n_flies):
        seed = base_seed + i
        sim = FeedingMazeSimulator(
            graph=graph,
            maze=maze,
            seed=seed,
        )
        result = run_single_fly(sim, max_steps)
        result['seed'] = seed
        results.append(result)
        print(f"  Fly {i+1}/{n_flies}: {result['outcome']} ({result['steps']} steps)")
    
    return results


def analyze_results(results: list) -> dict:
    """Analyze swarm results."""
    n = len(results)
    escaped = sum(1 for r in results if r['outcome'] == 'ESCAPED')
    starved = sum(1 for r in results if r['outcome'] == 'STARVED')
    zapped = sum(1 for r in results if r['outcome'] == 'ZAPPED')
    timeout = sum(1 for r in results if r['outcome'] == 'TIMEOUT')
    
    escape_rate = escaped / n * 100
    
    if escape_rate >= 75:
        stars = '★★★'
    elif escape_rate >= 50:
        stars = '★★'
    elif escape_rate >= 25:
        stars = '★'
    else:
        stars = 'no stars'
    
    return {
        'escaped': escaped,
        'starved': starved,
        'zapped': zapped,
        'timeout': timeout,
        'escape_rate': escape_rate,
        'stars': stars,
    }


def run_budget_spike(graph, n_flies: int, max_steps: int, base_seed: int):
    """P0.2: Budget economy dry-run."""
    print("\n" + "=" * 70)
    print("P0.2: BUDGET ECONOMY DRY-RUN")
    print("=" * 70)
    print(f"\nPrice list: {PRICES}")
    print(f"Budget tiers: {BUDGETS}")
    
    results_by_budget = {}
    
    for tier, budget in BUDGETS.items():
        print(f"\n--- Budget: {tier} (${budget}) ---")
        maze, spent = create_budget_level(budget)
        print(f"  Spent: ${spent}")
        print(f"  Stimuli placed: {len(maze.stimuli)}")
        
        results = run_swarm(graph, maze, n_flies, max_steps, base_seed)
        analysis = analyze_results(results)
        analysis['spent'] = spent
        results_by_budget[tier] = analysis
        
        print(f"  Result: {analysis['escaped']}/{n_flies} escaped ({analysis['escape_rate']:.0f}%) → {analysis['stars']}")
    
    return results_by_budget


def run_zapper_spike(graph, n_flies: int, max_steps: int, base_seed: int):
    """P0.3: Zapper × Trail."""
    print("\n" + "=" * 70)
    print("P0.3: ZAPPER × TRAIL")
    print("=" * 70)
    
    results_by_config = {}
    
    for zappers, label in [(False, 'OFF'), (True, 'ON (3 zappers)')]:
        print(f"\n--- Zappers: {label} ---")
        maze = create_zapper_level(include_zappers=zappers, n_zappers=3)
        
        results = run_swarm(graph, maze, n_flies, max_steps, base_seed)
        analysis = analyze_results(results)
        results_by_config[label] = analysis
        
        print(f"  Result: {analysis['escaped']}/{n_flies} escaped, {analysis['zapped']}/{n_flies} zapped")
    
    return results_by_config


def main():
    parser = argparse.ArgumentParser(description='P0 Spikes: Budget + Zapper')
    parser.add_argument('--n-flies', type=int, default=5, help='Flies per test')
    parser.add_argument('--max-steps', type=int, default=1500, help='Max steps')
    parser.add_argument('--seed', type=int, default=42, help='Base seed')
    parser.add_argument('--spike', choices=['budget', 'zapper', 'both'], default='both')
    args = parser.parse_args()
    
    print("Loading visual_motor graph...")
    graph = load_visual_motor(Path('data'))
    
    budget_results = None
    zapper_results = None
    
    if args.spike in ['budget', 'both']:
        budget_results = run_budget_spike(graph, args.n_flies, args.max_steps, args.seed)
    
    if args.spike in ['zapper', 'both']:
        zapper_results = run_zapper_spike(graph, args.n_flies, args.max_steps, args.seed)
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    if budget_results:
        print("\n### P0.2 Budget Economy ###")
        print(f"{'Tier':<12} {'Budget':<8} {'Spent':<8} {'Escaped':<10} {'Stars':<8}")
        print("-" * 50)
        for tier, r in budget_results.items():
            print(f"{tier:<12} ${BUDGETS[tier]:<7} ${r['spent']:<7} {r['escape_rate']:.0f}%{'':<7} {r['stars']}")
    
    if zapper_results:
        print("\n### P0.3 Zapper × Trail ###")
        print(f"{'Config':<20} {'Escaped':<10} {'Zapped':<10} {'Stars':<8}")
        print("-" * 50)
        for config, r in zapper_results.items():
            print(f"{config:<20} {r['escape_rate']:.0f}%{'':<7} {r['zapped']:<10} {r['stars']}")


if __name__ == '__main__':
    main()
