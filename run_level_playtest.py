#!/usr/bin/env python3
"""
LEVEL PLAYTEST PASS
===================

Goal: Cool simulation / tech demo of real fly brain.
Game needs to be playable and somewhat fun. Quirks are OK (even desirable).
NOT chasing perfect balance.

Creates 2-4 level layouts, runs small swarms, notes escape rates and quirky behaviors.
"""

import sys
import time
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Optional

sys.path.insert(0, str(Path(__file__).parent / "src"))

import numpy as np
from graph_loader import load_visual_motor
from feeding_maze_sim import FeedingMazeSimulator, GameState
from maze import Maze, Wall, Stimulus, StimulusType, Jar


# =============================================================================
# LEVEL DESIGNS
# =============================================================================

def create_level_1_shadow_corridor() -> Tuple[Maze, str, str]:
    """
    Level 1: Shadow Corridor
    
    Simple 3-room layout with shadow zones guiding the fly.
    Demonstrates: scototaxis (shadow preference), basic chemotaxis trail.
    
    ┌─────────────────────────────────────────────────────────┐
    │  SPAWN      ▓▓SHADOW▓▓      CORRIDOR     ┌──────────────┤
    │   ●═══════════════════════════════════════╡  EXIT ROOM  │
    │            (crumbs)                       │   ▌   ☀     │
    │                                           └──────────────┤
    └─────────────────────────────────────────────────────────┘
    """
    width, height = 700, 300
    maze = Maze(
        width=width, height=height,
        fly_start_x=50, fly_start_y=150, fly_start_theta=0,
        time_limit=2000,
    )
    
    # Room dividers
    maze.walls.append(Wall(x=200, y=0, width=10, height=100))
    maze.walls.append(Wall(x=200, y=200, width=10, height=100))
    maze.walls.append(Wall(x=400, y=0, width=10, height=100))
    maze.walls.append(Wall(x=400, y=200, width=10, height=100))
    
    # Exit room with baffle
    maze.walls.append(Wall(x=550, y=0, width=10, height=120))
    maze.walls.append(Wall(x=550, y=180, width=10, height=120))
    maze.walls.append(Wall(x=580, y=100, width=10, height=100))  # Baffle
    
    # Exit
    exit_x, exit_y = width - 40, height // 2
    maze.stimuli.append(Stimulus(type=StimulusType.EXIT, x=exit_x, y=exit_y, intensity=1.5, sigma=40))
    maze.jar = Jar(x=exit_x, y=exit_y, radius=30, opening_direction=np.pi, opening_width=0.85, has_bait=False)
    
    # Shadow corridor (the "cool" part - fly prefers shadow)
    maze.stimuli.append(Stimulus(type=StimulusType.SHADOW, x=150, y=150, intensity=1.2, sigma=80))
    maze.stimuli.append(Stimulus(type=StimulusType.SHADOW, x=300, y=150, intensity=1.0, sigma=70))
    
    # Trail crumbs (stronger near baffle to guide around it)
    for x in [100, 180, 260, 340, 450, 520]:
        maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=x, y=150, intensity=0.8, sigma=50))
    # Strong crumbs around baffle
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=560, y=80, intensity=1.2, sigma=45))  # Below baffle
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=620, y=150, intensity=1.3, sigma=50))  # Past baffle
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=650, y=150, intensity=1.4, sigma=45))  # Near exit
    
    # Threat for initial takeoff
    maze.stimuli.append(Stimulus(type=StimulusType.THREAT, x=30, y=150, intensity=0.8, sigma=50))
    
    name = "Shadow Corridor"
    desc = "Shadow zones guide fly through 3 rooms. Demonstrates scototaxis."
    return maze, name, desc


def create_level_2_dead_end_trap() -> Tuple[Maze, str, str]:
    """
    Level 2: Dead End Trap
    
    Has a tempting dead end with fruit (trap!) guarded by vinegar.
    Demonstrates: aversive chemotaxis, risk of getting stuck.
    
    ┌─────────────────────────────────────────────────────────┐
    │  SPAWN         ╔═══════╗                 ┌──────────────┤
    │   ●════════════║ TRAP  ║═════════════════╡  EXIT ROOM  │
    │      crumbs    ║🍎(vin)║   main path     │   ▌   ☀     │
    │                ╚═══════╝                 └──────────────┤
    └─────────────────────────────────────────────────────────┘
    """
    width, height = 700, 350
    maze = Maze(
        width=width, height=height,
        fly_start_x=50, fly_start_y=175, fly_start_theta=0,
        time_limit=2000,
    )
    
    # Dead end trap room (upper)
    maze.walls.append(Wall(x=200, y=220, width=120, height=10))  # Bottom of trap
    maze.walls.append(Wall(x=200, y=320, width=120, height=10))  # Top of trap
    maze.walls.append(Wall(x=200, y=220, width=10, height=100))  # Left side
    maze.walls.append(Wall(x=310, y=220, width=10, height=70))   # Right side (partial - entrance)
    
    # Main corridor walls
    maze.walls.append(Wall(x=400, y=0, width=10, height=130))
    maze.walls.append(Wall(x=400, y=220, width=10, height=130))
    
    # Exit room with baffle
    maze.walls.append(Wall(x=550, y=0, width=10, height=140))
    maze.walls.append(Wall(x=550, y=210, width=10, height=140))
    maze.walls.append(Wall(x=580, y=120, width=10, height=110))
    
    # Exit
    exit_x, exit_y = width - 40, height // 2
    maze.stimuli.append(Stimulus(type=StimulusType.EXIT, x=exit_x, y=exit_y, intensity=1.5, sigma=40))
    maze.jar = Jar(x=exit_x, y=exit_y, radius=30, opening_direction=np.pi, opening_width=0.85, has_bait=False)
    
    # TRAP: Fruit in dead end (tempting but weaker)
    maze.stimuli.append(Stimulus(type=StimulusType.FRUIT, x=250, y=270, intensity=1.0, sigma=40))
    
    # Vinegar guard at trap entrance (weaker aversive)
    maze.stimuli.append(Stimulus(type=StimulusType.VINEGAR, x=300, y=240, intensity=0.8, sigma=35))
    
    # Main trail (stronger to compete with trap fruit)
    for x in [100, 180, 350, 450, 520]:
        maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=x, y=175, intensity=1.0, sigma=50))
    # Strong crumbs around exit baffle
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=560, y=120, intensity=1.2, sigma=45))
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=620, y=175, intensity=1.3, sigma=50))
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=650, y=175, intensity=1.4, sigma=45))
    
    # Threat
    maze.stimuli.append(Stimulus(type=StimulusType.THREAT, x=30, y=175, intensity=0.8, sigma=50))
    
    name = "Dead End Trap"
    desc = "Tempting fruit in dead end, guarded by vinegar. Tests aversive chemotaxis."
    return maze, name, desc


def create_level_3_long_hallway() -> Tuple[Maze, str, str]:
    """
    Level 3: Long Hallway
    
    Very long corridor - walking is too slow, must fly.
    Demonstrates: walk-vs-fly economy, takeoff triggers.
    
    ┌────────────────────────────────────────────────────────────────────────┐
    │  SPAWN    THREAT→     ═══════════════════════════════════════  EXIT   │
    │   ●         ⚡         very long corridor (needs flight)         ☀    │
    └────────────────────────────────────────────────────────────────────────┘
    """
    width, height = 1000, 200
    maze = Maze(
        width=width, height=height,
        fly_start_x=50, fly_start_y=100, fly_start_theta=0,
        time_limit=2500,  # Longer time for long level
    )
    
    # No internal walls - just a long corridor
    
    # Exit room entrance
    maze.walls.append(Wall(x=850, y=0, width=10, height=70))
    maze.walls.append(Wall(x=850, y=130, width=10, height=70))
    maze.walls.append(Wall(x=880, y=50, width=10, height=100))  # Baffle
    
    # Exit
    exit_x, exit_y = width - 40, height // 2
    maze.stimuli.append(Stimulus(type=StimulusType.EXIT, x=exit_x, y=exit_y, intensity=1.8, sigma=45))
    maze.jar = Jar(x=exit_x, y=exit_y, radius=30, opening_direction=np.pi, opening_width=0.85, has_bait=False)
    
    # More crumbs for guidance, stronger near exit
    for x in [150, 300, 450, 600, 750]:
        maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=x, y=100, intensity=1.0, sigma=70))
    # Strong crumbs around exit baffle
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=860, y=60, intensity=1.2, sigma=50))
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=920, y=100, intensity=1.4, sigma=50))
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=950, y=100, intensity=1.5, sigma=45))
    
    # Threats to encourage flight
    maze.stimuli.append(Stimulus(type=StimulusType.THREAT, x=30, y=100, intensity=1.0, sigma=60))
    maze.stimuli.append(Stimulus(type=StimulusType.THREAT, x=400, y=100, intensity=0.6, sigma=50))
    
    name = "Long Hallway"
    desc = "Very long corridor. Walking too slow - demonstrates flight necessity."
    return maze, name, desc


def create_level_4_light_dark_choice() -> Tuple[Maze, str, str]:
    """
    Level 4: Light vs Dark Choice
    
    Two paths: lit (easier to see exit) vs dark (fly prefers).
    Demonstrates: scototaxis vs chemotaxis conflict.
    
    ┌─────────────────────────────────────────────────────────┐
    │            ══════☀LIGHT PATH☀══════                     │
    │  SPAWN   /                          \   ┌───────────────┤
    │   ●═════<                            >══╡  EXIT ROOM    │
    │          \                          /   │   ▌   ☀       │
    │            ══════▓DARK PATH▓═══════     └───────────────┤
    └─────────────────────────────────────────────────────────┘
    """
    width, height = 700, 400
    maze = Maze(
        width=width, height=height,
        fly_start_x=50, fly_start_y=200, fly_start_theta=0,
        time_limit=2000,
    )
    
    # Fork walls
    maze.walls.append(Wall(x=150, y=170, width=250, height=10))  # Upper path bottom
    maze.walls.append(Wall(x=150, y=220, width=250, height=10))  # Lower path top
    
    # Merge walls
    maze.walls.append(Wall(x=400, y=100, width=10, height=80))
    maze.walls.append(Wall(x=400, y=220, width=10, height=80))
    
    # Exit room with baffle
    maze.walls.append(Wall(x=550, y=0, width=10, height=160))
    maze.walls.append(Wall(x=550, y=240, width=10, height=160))
    maze.walls.append(Wall(x=580, y=140, width=10, height=120))
    
    # Exit
    exit_x, exit_y = width - 40, height // 2
    maze.stimuli.append(Stimulus(type=StimulusType.EXIT, x=exit_x, y=exit_y, intensity=1.5, sigma=40))
    maze.jar = Jar(x=exit_x, y=exit_y, radius=30, opening_direction=np.pi, opening_width=0.85, has_bait=False)
    
    # UPPER PATH: Lit (weaker light - still avoids but less strongly)
    maze.stimuli.append(Stimulus(type=StimulusType.LIGHT, x=250, y=120, intensity=0.8, sigma=60))
    for x in [180, 280, 380]:
        maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=x, y=120, intensity=1.0, sigma=45))  # Stronger to compete with light
    
    # LOWER PATH: Dark (fly prefers shadow)
    maze.stimuli.append(Stimulus(type=StimulusType.SHADOW, x=250, y=280, intensity=1.0, sigma=70))
    for x in [180, 280, 380]:
        maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=x, y=280, intensity=0.9, sigma=45))
    
    # Common path after merge (stronger crumbs)
    for x in [450, 520]:
        maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=x, y=200, intensity=1.0, sigma=50))
    # Strong crumbs around exit baffle
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=560, y=140, intensity=1.2, sigma=45))
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=620, y=200, intensity=1.3, sigma=50))
    maze.stimuli.append(Stimulus(type=StimulusType.CRUMB, x=650, y=200, intensity=1.4, sigma=45))
    
    # Threat
    maze.stimuli.append(Stimulus(type=StimulusType.THREAT, x=30, y=200, intensity=0.8, sigma=50))
    
    name = "Light vs Dark Choice"
    desc = "Two paths: lit vs shadow. Tests scototaxis preference over stronger crumbs."
    return maze, name, desc


# =============================================================================
# PLAYTEST RUNNER
# =============================================================================

def run_single_fly(sim, max_steps: int) -> dict:
    """Run one fly and track behavior."""
    sim.reset()
    
    exit_x = sim.maze.jar.x if sim.maze.jar else sim.maze.width - 40
    exit_y = sim.maze.jar.y if sim.maze.jar else sim.maze.height // 2
    
    min_dist = float('inf')
    path = [(sim.x, sim.y)]
    modes = []
    
    for step in range(max_steps):
        result = sim.step()
        
        path.append((sim.x, sim.y))
        modes.append(sim.flight.mode.value if hasattr(sim.flight, 'mode') else 'unknown')
        
        dist = np.sqrt((sim.x - exit_x)**2 + (sim.y - exit_y)**2)
        min_dist = min(min_dist, dist)
        
        if result == GameState.WON:
            return {
                'outcome': 'ESCAPED',
                'steps': step + 1,
                'min_dist': min_dist,
                'path': path,
                'modes': modes,
                'takeoffs': sim.state.total_takeoffs,
                'feeds': sim.state.total_feeds,
            }
        if result == GameState.STARVED:
            return {
                'outcome': 'STARVED',
                'steps': step + 1,
                'min_dist': min_dist,
                'path': path,
                'modes': modes,
                'takeoffs': sim.state.total_takeoffs,
                'feeds': sim.state.total_feeds,
            }
        if result == GameState.ZAPPED:
            return {
                'outcome': 'ZAPPED',
                'steps': step + 1,
                'min_dist': min_dist,
                'path': path,
                'modes': modes,
                'takeoffs': sim.state.total_takeoffs,
                'feeds': sim.state.total_feeds,
            }
    
    return {
        'outcome': 'TIMEOUT',
        'steps': max_steps,
        'min_dist': min_dist,
        'path': path,
        'modes': modes,
        'takeoffs': sim.state.total_takeoffs,
        'feeds': sim.state.total_feeds,
    }


def analyze_quirks(results: list) -> list:
    """Find interesting/quirky behaviors in the results."""
    quirks = []
    
    for r in results:
        # Check for interesting behaviors
        if r['feeds'] > 0 and r['outcome'] == 'ESCAPED':
            quirks.append(f"Fly fed {r['feeds']}x and still escaped - hungry but determined!")
        
        if r['takeoffs'] >= 3:
            quirks.append(f"Fly took off {r['takeoffs']} times - nervous flier!")
        
        if r['outcome'] == 'TIMEOUT' and r['min_dist'] < 100:
            quirks.append(f"Fly got within {r['min_dist']:.0f}px of exit but didn't make it - so close!")
        
        if r['outcome'] == 'STARVED' and r['min_dist'] < 150:
            quirks.append(f"Starved near the exit ({r['min_dist']:.0f}px away) - tragic!")
    
    return quirks


def run_level_playtest(graph, maze, name, desc, n_flies: int, max_steps: int, base_seed: int) -> dict:
    """Run playtest on one level."""
    print(f"\n{'='*60}")
    print(f"LEVEL: {name}")
    print(f"{'='*60}")
    print(f"  {desc}")
    print(f"  Arena: {maze.width}x{maze.height}")
    print(f"  Stimuli: {len(maze.stimuli)}")
    
    results = []
    
    for i in range(n_flies):
        seed = base_seed + i
        sim = FeedingMazeSimulator(graph=graph, maze=maze, seed=seed)
        result = run_single_fly(sim, max_steps)
        result['seed'] = seed
        results.append(result)
        print(f"  Fly {i+1}/{n_flies}: {result['outcome']} ({result['steps']} steps, {result['takeoffs']} takeoffs)")
    
    # Analyze
    escaped = sum(1 for r in results if r['outcome'] == 'ESCAPED')
    starved = sum(1 for r in results if r['outcome'] == 'STARVED')
    zapped = sum(1 for r in results if r['outcome'] == 'ZAPPED')
    timeout = sum(1 for r in results if r['outcome'] == 'TIMEOUT')
    
    escape_rate = escaped / n_flies * 100
    
    if escape_rate >= 75:
        stars = '★★★'
        balance = 'Too easy?'
    elif escape_rate >= 50:
        stars = '★★'
        balance = 'Good balance'
    elif escape_rate >= 25:
        stars = '★'
        balance = 'Challenging'
    elif escape_rate > 0:
        stars = 'partial'
        balance = 'Very hard'
    else:
        stars = '❌'
        balance = 'Unwinnable?'
    
    quirks = analyze_quirks(results)
    
    print(f"\n  RESULTS: {escaped}/{n_flies} escaped ({escape_rate:.0f}%) → {stars}")
    print(f"  Balance: {balance}")
    if quirks:
        print(f"  Quirks:")
        for q in quirks[:3]:
            print(f"    - {q}")
    
    return {
        'name': name,
        'desc': desc,
        'escaped': escaped,
        'starved': starved,
        'zapped': zapped,
        'timeout': timeout,
        'escape_rate': escape_rate,
        'stars': stars,
        'balance': balance,
        'quirks': quirks,
        'results': results,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Level Playtest Pass')
    parser.add_argument('--n-flies', type=int, default=5, help='Flies per level')
    parser.add_argument('--max-steps', type=int, default=1500, help='Max steps')
    parser.add_argument('--seed', type=int, default=42, help='Base seed')
    args = parser.parse_args()
    
    print("Loading visual_motor graph...")
    graph = load_visual_motor(Path('data'))
    
    # Create all levels
    levels = [
        create_level_1_shadow_corridor(),
        create_level_2_dead_end_trap(),
        create_level_3_long_hallway(),
        create_level_4_light_dark_choice(),
    ]
    
    all_results = []
    
    for maze, name, desc in levels:
        result = run_level_playtest(graph, maze, name, desc, args.n_flies, args.max_steps, args.seed)
        all_results.append(result)
    
    # Final summary
    print("\n" + "=" * 70)
    print("PLAYTEST SUMMARY")
    print("=" * 70)
    print(f"\n{'Level':<25} {'Escaped':<12} {'Balance':<15} {'Tech Demo?'}")
    print("-" * 70)
    
    for r in all_results:
        demo_worthy = "✅ Yes" if r['escape_rate'] > 0 and r['escape_rate'] < 100 else "⚠️ Needs tuning"
        print(f"{r['name']:<25} {r['escape_rate']:.0f}% {r['stars']:<6} {r['balance']:<15} {demo_worthy}")
    
    print("\n### QUIRKY BEHAVIORS (Tech Demo Gold) ###")
    for r in all_results:
        if r['quirks']:
            print(f"\n{r['name']}:")
            for q in r['quirks'][:2]:
                print(f"  - {q}")
    
    print("\n### RECOMMENDATIONS ###")
    for r in all_results:
        if r['escape_rate'] == 0:
            print(f"  {r['name']}: Possibly unwinnable - add more crumbs or weaken obstacles")
        elif r['escape_rate'] == 100:
            print(f"  {r['name']}: Too easy - reduce crumbs or add hazards")
        else:
            print(f"  {r['name']}: Good for demo ({r['escape_rate']:.0f}% escape)")


if __name__ == '__main__':
    main()
