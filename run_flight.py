#!/usr/bin/env python3
"""
Fly Maze - FLIGHT Mode with MaleCNS LIF

THE FLY IS FLYING, NOT WALKING.

Pure-graph chemotaxis with momentum-based flight dynamics:
- Higher speeds, inertia, momentum
- Flight DN motor readout (DNa01, DNg13, DNp09, etc.)
- Yaw control via differential wing activity

Usage:
    python run_flight.py                 # Run flight herding
    python run_flight.py --retries 5     # With multiple attempts
"""

import sys
import argparse
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from scripts.download_connectome import main as download_data


def main():
    parser = argparse.ArgumentParser(description="MaleCNS Flight Maze (FLYING)")
    parser.add_argument("--download", action="store_true", help="Download connectome data only")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--current", type=float, default=6.0, help="Odor injection current")
    parser.add_argument("--retries", type=int, default=3, help="Number of retries")
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
    from src.flight_maze_sim import FlightMazeSimulator, GameState, create_flight_herding_level
    from src.visualization import (
        render_maze_frame, save_maze_animation, save_maze_frame,
        setup_maze_axes, draw_maze_walls, draw_maze_stimuli, draw_jar,
        draw_path, draw_fly_at, plot_motor_traces, COLORS
    )
    import numpy as np
    import matplotlib.pyplot as plt
    from PIL import Image
    import io
    
    print("\n" + "="*60)
    print("FLY MAZE - FLIGHT MODE")
    print("="*60)
    print("  THE FLY IS FLYING, NOT WALKING")
    print("  [Pure-graph chemotaxis with momentum-based flight]")
    print("  [Flight DNs: DNa01, DNg13, DNp09, DNb01...]")
    
    print("\nLoading MaleCNS connectome...")
    graph = MaleCNSGraph(data_dir)
    graph.load()
    graph.extract_motor1hop()
    
    # Create flight-optimized level
    maze = create_flight_herding_level()
    
    print(f"\nLevel: {maze.name}")
    print(f"Arena: {maze.width} x {maze.height}")
    print(f"Walls: {len(maze.walls)}")
    print(f"Stimuli: {len(maze.stimuli)}")
    if maze.jar:
        print(f"Jar at: ({maze.jar.x}, {maze.jar.y}), radius={maze.jar.radius}")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Custom frame renderer for flight
    def render_flight_frame(sim, maze, title, won=False):
        fig, (ax_maze, ax_motor) = plt.subplots(1, 2, figsize=(14, 5))
        
        status = "WON!" if won else f"Step {sim.state.step}"
        setup_maze_axes(ax_maze, maze, f"{title} — {status}")
        
        draw_maze_walls(ax_maze, maze.walls)
        draw_maze_stimuli(ax_maze, maze.stimuli)
        draw_jar(ax_maze, maze.jar, highlight_win=won)
        
        # Draw path with speed coloring
        if len(sim.path_x) > 1:
            for i in range(1, len(sim.path_x)):
                dx = sim.path_x[i] - sim.path_x[i-1]
                dy = sim.path_y[i] - sim.path_y[i-1]
                speed = np.sqrt(dx**2 + dy**2)
                # Color by speed: slow=gray, fast=orange
                alpha = min(0.8, 0.2 + speed / 4.0)
                ax_maze.plot(
                    [sim.path_x[i-1], sim.path_x[i]],
                    [sim.path_y[i-1], sim.path_y[i]],
                    color=COLORS["fly"],
                    alpha=alpha,
                    linewidth=1,
                )
        
        draw_fly_at(ax_maze, sim.x, sim.y, sim.theta, heading_length=20)
        
        # Velocity vector
        vx = sim.flight.state.vx
        vy = sim.flight.state.vy
        ax_maze.arrow(
            sim.x, sim.y, vx * 5, vy * 5,
            head_width=4, head_length=3,
            fc='blue', ec='blue', alpha=0.6
        )
        
        # Start marker
        from matplotlib.patches import Circle
        start = Circle(
            (maze.fly_start_x, maze.fly_start_y),
            radius=5, color="blue", alpha=0.4, zorder=4
        )
        ax_maze.add_patch(start)
        
        # Motor traces
        if len(sim.state.thrusts) > 0:
            plot_motor_traces(
                ax_motor,
                np.array(sim.state.thrusts),
                np.array(sim.state.turns),
                title="Flight motor output"
            )
        
        # Add speed info
        speed = sim.flight.state.speed
        ax_maze.text(
            10, maze.height - 15,
            f"Speed: {speed:.1f}",
            fontsize=9, fontfamily="monospace",
            color="black", alpha=0.7
        )
        
        plt.tight_layout()
        
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=100, facecolor="white")
        buf.seek(0)
        img = Image.open(buf)
        frame = np.array(img)
        plt.close(fig)
        
        return frame
    
    # Run with retries
    best_result = None
    best_metrics = None
    best_frames = []
    
    for attempt in range(args.retries):
        seed = args.seed + attempt
        print(f"\n{'='*60}")
        print(f"FLIGHT ATTEMPT {attempt + 1}/{args.retries} (seed={seed})")
        print(f"{'='*60}")
        
        sim = FlightMazeSimulator(graph, maze, seed=seed, odor_current=args.current)
        
        frames = []
        save_every = 3
        
        while sim.state.game_state == GameState.RUNNING:
            result = sim.step()
            
            if sim.state.step % save_every == 0:
                frame = render_flight_frame(
                    sim, maze,
                    title=f"{maze.name} (FLIGHT)",
                )
                frames.append(frame)
            
            if sim.state.step % 200 == 0:
                jar_dist = ""
                if maze.jar:
                    d = np.sqrt(
                        (sim.x - maze.jar.x) ** 2 + 
                        (sim.y - maze.jar.y) ** 2
                    )
                    jar_dist = f", jar={d:.0f}"
                speed = sim.flight.state.speed
                print(f"  Step {sim.state.step}: pos=({sim.x:.0f}, {sim.y:.0f}), speed={speed:.1f}{jar_dist}")
        
        # Final frame
        won = sim.state.game_state == GameState.WON
        frame = render_flight_frame(sim, maze, title=f"{maze.name} (FLIGHT)", won=won)
        frames.append(frame)
        
        metrics = sim.get_metrics()
        
        print(f"\nResult: {sim.state.game_state.value.upper()}")
        print(f"Steps: {sim.state.step}")
        print(f"Path length: {metrics['path_length']:.0f}")
        print(f"Mean speed: {metrics.get('mean_speed', 0):.2f}")
        if maze.jar:
            print(f"Min distance to jar: {metrics['min_distance_to_jar']:.1f}")
        
        if won:
            print(f"*** FLIGHT WIN at step {sim.state.win_step}! ***")
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
    print("FLIGHT RESULTS")
    print(f"{'='*60}")
    
    final_state = best_result.state.game_state
    print(f"Final state: {final_state.value.upper()}")
    print(f"Total steps: {best_result.state.step}")
    print(f"Path length: {best_metrics['path_length']:.0f}")
    print(f"Mean speed: {best_metrics.get('mean_speed', 0):.2f}")
    print(f"Max speed: {best_metrics.get('max_speed', 0):.2f}")
    if maze.jar:
        print(f"Min distance to jar: {best_metrics['min_distance_to_jar']:.1f}")
    
    # Save animation
    if best_frames:
        gif_path = output_dir / "flight_herding.gif"
        save_maze_animation(best_frames, gif_path, fps=20)
        print(f"\nSaved animation: {gif_path}")
    
    # Save final frame
    frame_path = output_dir / "flight_herding_final.png"
    final_frame = render_flight_frame(
        best_result, maze,
        title=f"{maze.name} (FLIGHT)",
        won=(final_state == GameState.WON)
    )
    Image.fromarray(final_frame).save(frame_path)
    print(f"Saved frame: {frame_path}")
    
    # Save metrics
    report = {
        "level": maze.name,
        "mode": "FLIGHT",
        "method": "PURE_GRAPH_LIF",
        "external_turn_bias": False,
        "seed": args.seed,
        "retries": args.retries,
        "final_state": final_state.value,
        "metrics": best_metrics,
        "flight_dns_used": True,
    }
    
    report_path = output_dir / "flight_herding_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Saved report: {report_path}")
    
    print(f"\n{'='*60}")
    if final_state == GameState.WON:
        print("SUCCESS! The FLYING fly was herded into the jar!")
        print("Pure MaleCNS flight + chemotaxis works!")
    else:
        print("Fly did not reach the jar in time.")
        print("Try adjusting placements or increasing retries.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
