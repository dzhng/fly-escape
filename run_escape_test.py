#!/usr/bin/env python3
"""
TRACK A: Test escape loom via LC4→DNp04 pathway in game loop.

SPIKE FINDING: LC4→DNp04 produces +829% escape DN spike increase.
This test verifies that a THREAT stimulus triggers escape behavior.
"""

import sys
sys.path.insert(0, 'src')

import numpy as np
from graph_loader import VisualMotorGraph
from feeding_maze_sim import FeedingMazeSimulator, GameState
from maze import Maze, StimulusType

def create_escape_test_maze(with_threat: bool = True) -> Maze:
    """Create a maze with a threat that should trigger escape."""
    maze = Maze(
        width=400,
        height=300,
        time_limit=500,
        fly_start_x=200,  # Start in center
        fly_start_y=150,
        fly_start_theta=0,  # Facing right
    )
    
    # Add fruit to the right (fly should approach)
    maze.add_stimulus(StimulusType.FRUIT, 350, 150, intensity=1.0, sigma=40)
    
    if with_threat:
        # Add threat between fly and fruit (should trigger escape)
        maze.add_stimulus(StimulusType.THREAT, 280, 150, intensity=1.5, sigma=60)
    
    return maze


def run_escape_test(with_threat: bool, max_steps: int = 300) -> dict:
    """Run simulation and return metrics."""
    maze = create_escape_test_maze(with_threat=with_threat)
    
    graph = VisualMotorGraph("data")
    graph.load()
    graph.extract_visual_motor(target_neurons=70000)
    
    sim = FeedingMazeSimulator(
        graph=graph,
        maze=maze,
        seed=42,
        starve_time_steps=10000,  # Long enough
    )
    
    # Track escape behavior
    escape_looms = []
    positions = []
    
    for step in range(max_steps):
        state = sim.step()
        escape_looms.append(sim.state.escape_looms[-1] if sim.state.escape_looms else 0)
        positions.append((sim.x, sim.y))
        
        if state != GameState.RUNNING:
            break
    
    # Analyze path
    xs = [p[0] for p in positions]
    ys = [p[1] for p in positions]
    
    # Did fly move away from threat?
    threat_x, threat_y = 280, 150
    initial_dist = np.sqrt((xs[0] - threat_x)**2 + (ys[0] - threat_y)**2)
    final_dist = np.sqrt((xs[-1] - threat_x)**2 + (ys[-1] - threat_y)**2)
    
    # How close did fly get to threat?
    min_threat_dist = min(np.sqrt((x - threat_x)**2 + (y - threat_y)**2) for x, y in positions)
    
    return {
        'with_threat': with_threat,
        'steps': len(positions),
        'initial_threat_dist': initial_dist,
        'final_threat_dist': final_dist,
        'min_threat_dist': min_threat_dist,
        'max_escape_loom': max(escape_looms) if escape_looms else 0,
        'escape_loom_triggered': sum(1 for l in escape_looms if l > 0.05),
        'final_x': xs[-1],
        'final_y': ys[-1],
    }


def main():
    print("=== TRACK A: ESCAPE LOOM TEST ===")
    print("Testing LC4→DNp04 pathway in game loop")
    print()
    
    # Test without threat (baseline)
    print("Running WITHOUT threat (baseline)...")
    baseline = run_escape_test(with_threat=False)
    
    print(f"  Final position: ({baseline['final_x']:.1f}, {baseline['final_y']:.1f})")
    print(f"  Min threat distance: {baseline['min_threat_dist']:.1f}")
    print()
    
    # Test with threat
    print("Running WITH threat...")
    with_threat = run_escape_test(with_threat=True)
    
    print(f"  Final position: ({with_threat['final_x']:.1f}, {with_threat['final_y']:.1f})")
    print(f"  Min threat distance: {with_threat['min_threat_dist']:.1f}")
    print(f"  Max escape loom: {with_threat['max_escape_loom']:.4f}")
    print(f"  Escape loom triggered: {with_threat['escape_loom_triggered']} times")
    print()
    
    # Compare
    print("=== COMPARISON ===")
    dist_delta = with_threat['min_threat_dist'] - baseline['min_threat_dist']
    print(f"Min threat distance: baseline={baseline['min_threat_dist']:.1f}, with_threat={with_threat['min_threat_dist']:.1f}")
    print(f"Delta: {dist_delta:+.1f}")
    
    if dist_delta > 20:
        print("✅ Fly AVOIDED threat (kept more distance)")
    elif with_threat['max_escape_loom'] > 0.05:
        print("⚠️ Escape loom TRIGGERED but avoidance unclear")
    else:
        print("❌ No escape behavior detected")


if __name__ == "__main__":
    main()
