#!/usr/bin/env python3
"""
Fly Maze - MaleCNS LIF Maze Herding Game

PURE GRAPH-BASED CHEMOTAXIS - No external turn bias.
The fly brain (MaleCNS connectome) IS the AI.

Herd the fly into the jar using fruit trails!

Usage:
    python run_maze.py                 # Run demo herding level
    python run_maze.py --level obstacles  # Run obstacle course
    python run_maze.py --retries 5     # Run with retry on timeout
"""

import sys
import argparse
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from scripts.download_connectome import main as download_data


def main():
    parser = argparse.ArgumentParser(description="MaleCNS Fly Maze Game (PURE LIF)")
    parser.add_argument("--download", action="store_true", help="Download connectome data only")
    parser.add_argument("--level", type=str, default="herding", 
                       choices=["herding", "obstacles"], help="Level to play")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--current", type=float, default=5.0, help="Odor injection current")
    parser.add_argument("--retries", type=int, default=3, help="Number of retries on timeout")
    parser.add_argument("--output", type=str, default="artifacts", help="Output directory")
    args = parser.parse_args()
    
    data_dir = Path(__file__).parent / "data"
    output_dir = Path(__file__).parent / args.output
    
    required_files = [
        "body-annotations.feather",
        "body-neurotransmitters.feather", 
        "connectome-weights.feather",
    ]
    
    missing = [f for f in required_files if not (data_dir / f).exists()]
    if missing or args.download:
        print("Downloading connectome data...")
        download_data()
        if args.download:
            return
    
    from src.graph_loader import MaleCNSGraph
    from src.maze import create_herding_level, create_obstacle_level
    from src.maze_sim import MazeSimulator, GameState
    from src.visualization import (
        render_maze_frame, save_maze_animation, save_maze_frame
    )
    import numpy as np
    
    print("\n" + "="*60)
    print("FLY MAZE - PURE GRAPH HERDING GAME")
    print("="*60)
    print("  [NO external turn bias - fly brain is the AI]")
    print("  Herd the fly into the jar using fruit trails!")
    
    print("\nLoading MaleCNS connectome...")
    graph = MaleCNSGraph(data_dir)
    graph.load()
    graph.extract_motor1hop()
    
    # Select level
    if args.level == "obstacles":
        maze = create_obstacle_level()
    else:
        maze = create_herding_level()
    
    print(f"\nLevel: {maze.name}")
    print(f"Arena: {maze.width} x {maze.height}")
    print(f"Walls: {len(maze.walls)}")
    print(f"Stimuli: {len(maze.stimuli)}")
    if maze.jar:
        print(f"Jar at: ({maze.jar.x}, {maze.jar.y}), radius={maze.jar.radius}")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Run with retries
    best_result = None
    best_metrics = None
    best_frames = []
    
    for attempt in range(args.retries):
        seed = args.seed + attempt
        print(f"\n{'='*60}")
        print(f"ATTEMPT {attempt + 1}/{args.retries} (seed={seed})")
        print(f"{'='*60}")
        
        sim = MazeSimulator(graph, maze, seed=seed, odor_current=args.current)
        
        frames = []
        save_every = 3
        
        while sim.state.state == GameState.RUNNING:
            result = sim.step()
            
            if sim.state.step % save_every == 0:
                frame = render_maze_frame(
                    maze,
                    sim.state,
                    sim.state.thrusts,
                    sim.state.turns,
                    title=f"{maze.name} (pure LIF)",
                )
                frames.append(frame)
            
            if sim.state.step % 300 == 0:
                jar_dist = ""
                if maze.jar:
                    d = np.sqrt(
                        (sim.state.x - maze.jar.x) ** 2 + 
                        (sim.state.y - maze.jar.y) ** 2
                    )
                    jar_dist = f", jar_dist={d:.1f}"
                print(f"  Step {sim.state.step}: pos=({sim.state.x:.1f}, {sim.state.y:.1f}){jar_dist}")
        
        # Final frame
        won = sim.state.state == GameState.WON
        frame = render_maze_frame(
            maze,
            sim.state,
            sim.state.thrusts,
            sim.state.turns,
            title=f"{maze.name} (pure LIF)",
            won=won,
        )
        frames.append(frame)
        
        metrics = sim.get_metrics()
        
        print(f"\nResult: {sim.state.state.value.upper()}")
        print(f"Steps: {sim.state.step}")
        if maze.jar:
            print(f"Min distance to jar: {metrics['min_distance_to_jar']:.1f}")
        
        if won:
            print(f"*** WIN at step {sim.state.win_step}! ***")
            best_result = sim
            best_metrics = metrics
            best_frames = frames
            break
        
        # Keep best attempt
        if best_result is None or (
            metrics.get('min_distance_to_jar', float('inf')) < 
            best_metrics.get('min_distance_to_jar', float('inf'))
        ):
            best_result = sim
            best_metrics = metrics
            best_frames = frames
    
    # Save results
    print(f"\n{'='*60}")
    print("FINAL RESULTS")
    print(f"{'='*60}")
    
    final_state = best_result.state.state
    print(f"Final state: {final_state.value.upper()}")
    print(f"Total steps: {best_result.state.step}")
    if maze.jar:
        print(f"Min distance to jar: {best_metrics['min_distance_to_jar']:.1f}")
    
    # Save animation
    if best_frames:
        gif_path = output_dir / f"maze_{args.level}.gif"
        save_maze_animation(best_frames, gif_path, fps=15)
        print(f"\nSaved animation: {gif_path}")
    
    # Save final frame
    frame_path = output_dir / f"maze_{args.level}_final.png"
    save_maze_frame(
        maze,
        best_result.state,
        best_result.state.thrusts,
        best_result.state.turns,
        frame_path,
        title=f"{maze.name} (pure LIF)",
        won=(final_state == GameState.WON),
    )
    print(f"Saved frame: {frame_path}")
    
    # Save metrics
    report = {
        "level": maze.name,
        "method": "PURE_GRAPH_LIF",
        "external_turn_bias": False,
        "seed": args.seed,
        "retries": args.retries,
        "final_state": final_state.value,
        "metrics": best_metrics,
    }
    
    report_path = output_dir / f"maze_{args.level}_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Saved report: {report_path}")
    
    # Save level JSON
    level_path = output_dir / f"maze_{args.level}_level.json"
    with open(level_path, "w") as f:
        json.dump(maze.to_dict(), f, indent=2)
    print(f"Saved level: {level_path}")
    
    print(f"\n{'='*60}")
    if final_state == GameState.WON:
        print("SUCCESS! The fly was herded into the jar!")
        print("Pure MaleCNS graph chemotaxis works for maze navigation.")
    else:
        print("Fly did not reach the jar in time.")
        print("Try adjusting placements or increasing retries.")
    print(f"{'='*60}")
    
    print("\nArtifacts:")
    for f in sorted(output_dir.glob(f"maze_{args.level}*")):
        print(f"  {f.name}")


if __name__ == "__main__":
    main()
