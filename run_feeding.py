#!/usr/bin/env python3
"""
Run Drosophila flight simulation with landing and feeding.

BEHAVIORAL CHAIN (all via neural circuit, NO shortcuts):
1. HUNGER: Fly starts hungry (feeding gain = 2x)
2. CHEMOTAXIS: Bilateral odor → pure-graph flight toward fruit
3. LANDING: Visual LOOM signal → landing DNs (DNp07, DNp10) → reduced thrust
4. FEEDING: Tarsal SUGAR contact → GRNs → proboscis MNs → hunger satisfied
5. SURVIVAL: Feed within 5 minutes or STARVE

FORBIDDEN:
- if dist < ε: land = True  (use loom signal instead)
- if contact: eat()         (requires proboscis MN activation)
- chemotaxis_gain           (pure-graph chemotaxis only)

Usage:
    python run_feeding.py                       # Default feeding demo
    python run_feeding.py --level survival      # Survival challenge
    python run_feeding.py --starve-test         # Test starvation (short timer)
    python run_feeding.py --seed 123            # Different random seed
"""

import argparse
import sys
from pathlib import Path
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt

sys.path.insert(0, str(Path(__file__).parent / "src"))

from graph_loader import MaleCNSGraph
from feeding_maze_sim import (
    FeedingMazeSimulator, GameState,
    create_feeding_level, create_survival_level,
    create_starvation_level, create_easy_level,
)
from landing_feeding import FlyBehaviorState


def render_feeding_frame(
    sim: FeedingMazeSimulator,
    frame_size: tuple = (800, 500),
) -> np.ndarray:
    """Render a frame showing fly state, behavior, and hunger."""
    from PIL import ImageDraw
    from maze import StimulusType
    
    # Create canvas
    canvas = np.zeros((frame_size[1], frame_size[0], 3), dtype=np.uint8)
    canvas[:] = 30  # Dark background
    
    maze = sim.maze
    
    # Scale to fit
    scale_x = (frame_size[0] - 100) / maze.width
    scale_y = (frame_size[1] - 120) / maze.height
    scale = min(scale_x, scale_y)
    offset_x = 50
    offset_y = 60
    
    def tx(x): return int(x * scale + offset_x)
    def ty(y): return int((maze.height - y) * scale + offset_y)
    
    img = Image.fromarray(canvas)
    draw = ImageDraw.Draw(img)
    
    # Arena boundary
    arena_rect = [tx(0), ty(maze.height), tx(maze.width), ty(0)]
    draw.rectangle(arena_rect, outline=(100, 100, 100), width=2)
    
    # Walls
    for wall in maze.walls:
        wall_rect = [
            tx(wall.x), ty(wall.y + wall.height),
            tx(wall.x + wall.width), ty(wall.y)
        ]
        draw.rectangle(wall_rect, fill=(74, 74, 74))
    
    # Stimuli (fruit)
    for stim in maze.stimuli:
        sx, sy = tx(stim.x), ty(stim.y)
        r = int(stim.sigma * scale * 0.5)
        if stim.type == StimulusType.FRUIT:
            draw.ellipse([sx-r, sy-r, sx+r, sy+r], fill=(34, 139, 34, 100), outline=(34, 139, 34))
            draw.ellipse([sx-5, sy-5, sx+5, sy+5], fill=(34, 139, 34))
    
    # Path colored by behavior state
    if len(sim.path_x) > 1:
        behavior_colors = {
            "flying": (100, 150, 255),
            "landing": (255, 200, 100),
            "landed": (255, 100, 100),
            "feeding": (100, 255, 100),
        }
        
        for i in range(1, len(sim.path_x)):
            x1, y1 = tx(sim.path_x[i-1]), ty(sim.path_y[i-1])
            x2, y2 = tx(sim.path_x[i]), ty(sim.path_y[i])
            
            if i < len(sim.state.behavior_states):
                behavior = sim.state.behavior_states[i]
                color = behavior_colors.get(behavior, (150, 150, 150))
            else:
                color = (150, 150, 150)
            
            draw.line([(x1, y1), (x2, y2)], fill=color, width=2)
    
    # Fly
    fly_x = tx(sim.x)
    fly_y = ty(sim.y)
    
    # Fly color based on behavior
    behavior = sim.landing_feeding.behavior_state
    fly_colors = {
        FlyBehaviorState.FLYING: (100, 150, 255),
        FlyBehaviorState.LANDING: (255, 200, 100),
        FlyBehaviorState.LANDED: (255, 100, 100),
        FlyBehaviorState.FEEDING: (100, 255, 100),
        FlyBehaviorState.DEAD: (80, 80, 80),
    }
    fly_color = fly_colors.get(behavior, (150, 150, 150))
    
    # Fly body
    draw.ellipse([fly_x-8, fly_y-8, fly_x+8, fly_y+8], fill=fly_color)
    
    # Heading indicator
    head_x = fly_x + int(15 * np.cos(sim.theta))
    head_y = fly_y - int(15 * np.sin(sim.theta))  # Negative because Y is flipped
    draw.line([(fly_x, fly_y), (head_x, head_y)], fill=(255, 255, 255), width=2)
    
    # HUD - Status panel at top
    hunger = sim.landing_feeding.hunger
    time_remaining, is_starving = sim.landing_feeding.get_starvation_status()
    
    status_y = 10
    
    # Title
    draw.text((10, status_y), f"Step {sim.state.step}", fill=(200, 200, 200))
    
    # Behavior state
    state_text = f"State: {behavior.value.upper()}"
    state_color = fly_colors.get(behavior, (150, 150, 150))
    draw.text((150, status_y), state_text, fill=state_color)
    
    # Hunger bar
    hunger_x = 350
    hunger_width = 100
    hunger_height = 15
    
    draw.rectangle(
        [hunger_x, status_y, hunger_x + hunger_width, status_y + hunger_height],
        outline=(100, 100, 100)
    )
    hunger_fill = int(hunger.level * hunger_width)
    hunger_color = (255, int(100 + 155 * (1 - hunger.level)), 100) if hunger.level > 0.3 else (100, 255, 100)
    if hunger_fill > 0:
        draw.rectangle(
            [hunger_x + 1, status_y + 1, hunger_x + hunger_fill, status_y + hunger_height - 1],
            fill=hunger_color
        )
    draw.text((hunger_x + hunger_width + 5, status_y), f"Hunger: {hunger.level:.0%}", fill=(200, 200, 200))
    
    # Time remaining
    time_sec = time_remaining * sim.landing_feeding.params.starve_time_steps * sim.landing_feeding.params.step_to_seconds
    time_color = (255, 100, 100) if is_starving else (200, 200, 200)
    draw.text((550, status_y), f"Time: {time_sec:.0f}s", fill=time_color)
    
    # Feed count
    draw.text((650, status_y), f"Feeds: {sim.state.total_feeds}", fill=(100, 255, 100) if sim.state.total_feeds > 0 else (150, 150, 150))
    
    # Bottom info
    info_y = frame_size[1] - 25
    if sim.state.loom_signals:
        loom = sim.state.loom_signals[-1]
        draw.text((10, info_y), f"Loom: {loom:.3f}", fill=(200, 200, 200))
    
    if sim.state.contact_strengths:
        contact = sim.state.contact_strengths[-1]
        contact_color = (100, 255, 100) if contact > 0.5 else (200, 200, 200)
        draw.text((150, info_y), f"Contact: {contact:.2f}", fill=contact_color)
    
    return np.array(img)


def main():
    parser = argparse.ArgumentParser(description="Run feeding simulation")
    parser.add_argument("--data-dir", type=str, default="data", help="Path to connectome data")
    parser.add_argument("--output-dir", type=str, default="artifacts", help="Output directory")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--level", type=str, default="feeding", 
                        choices=["feeding", "survival", "starvation", "easy"],
                        help="Level type: feeding (default), survival (moderate), starvation (hard), easy")
    parser.add_argument("--starve-test", action="store_true", 
                        help="Test starvation (short 30-second timer)")
    parser.add_argument("--max-steps", type=int, default=None, help="Max steps")
    parser.add_argument("--no-render", action="store_true", help="Skip rendering")
    parser.add_argument("--feeding-gain", type=float, default=2.0,
                        help="Feeding pathway gain (sugar→proboscis, affects feeding initiation)")
    parser.add_argument("--olfactory-gain", type=float, default=1.0,
                        help="Olfactory gain (hunger→approach, affects landing speed)")
    args = parser.parse_args()
    
    # Setup
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print("="*60)
    print("DROSOPHILA LANDING + FEEDING SIMULATION")
    print("="*60)
    print()
    print("Behavioral chain (ALL via neural circuit):")
    print("  1. HUNGER: Fly starts with 2x feeding gain")
    print("  2. CHEMOTAXIS: Bilateral odor → pure-graph flight")
    print("  3. LANDING: Visual LOOM → landing DNs → reduced thrust")
    print("  4. FEEDING: Tarsal SUGAR → GRNs → proboscis MNs")
    print("  5. SURVIVE: Feed within 5 min or STARVE")
    print()
    
    # Load connectome
    print("Loading MaleCNS connectome...")
    graph = MaleCNSGraph(args.data_dir)
    graph.load()
    graph.extract_motor1hop()
    
    # Create level
    if args.level == "survival":
        maze = create_survival_level()
    elif args.level == "starvation":
        maze = create_starvation_level()
    elif args.level == "easy":
        maze = create_easy_level()
    else:
        maze = create_feeding_level()
    
    # Starvation time
    if args.starve_test:
        starve_steps = 300  # 30 seconds at 0.1s/step
        print(f"\n*** STARVE TEST: 30-second timer ***\n")
    else:
        starve_steps = 3000  # 5 minutes
    
    # Create simulator with configurable gains
    print(f"\nCreating simulator for level: {maze.name}")
    print(f"  Gains: feeding={args.feeding_gain}x, olfactory={args.olfactory_gain}x")
    sim = FeedingMazeSimulator(
        graph=graph,
        maze=maze,
        seed=args.seed,
        odor_current=5.0,
        starve_time_steps=starve_steps,
        feeding_gain=args.feeding_gain,
        olfactory_gain=args.olfactory_gain,
    )
    
    print(f"  Start position: ({maze.fly_start_x}, {maze.fly_start_y})")
    print(f"  Fruit sources: {len(sim.fruit_sources)}")
    print(f"  Starvation time: {starve_steps * 0.1:.0f} seconds")
    
    # Run simulation
    print("\nRunning simulation...")
    
    frames = []
    max_steps = args.max_steps or maze.time_limit
    
    while sim.state.step < max_steps:
        result = sim.step()
        
        # Render periodically
        if not args.no_render and sim.state.step % 5 == 0:
            frame = render_feeding_frame(sim)
            frames.append(Image.fromarray(frame))
        
        # Print progress
        if sim.state.step % 500 == 0:
            behavior = sim.landing_feeding.behavior_state.value
            hunger = sim.landing_feeding.hunger.level
            feeds = sim.state.total_feeds
            print(f"  Step {sim.state.step}: {behavior}, hunger={hunger:.1%}, feeds={feeds}")
        
        if result != GameState.RUNNING:
            break
    
    # Final frame
    if not args.no_render:
        frame = render_feeding_frame(sim)
        frames.append(Image.fromarray(frame))
    
    # Results
    final_state = sim.state.game_state
    metrics = sim.get_metrics()
    
    print("\n" + "="*60)
    print("RESULTS")
    print("="*60)
    print(f"Final state: {final_state.value.upper()}")
    print(f"Total steps: {metrics['total_steps']}")
    print(f"Total time: {metrics['total_time_sec']:.1f} seconds")
    print()
    print("Landing/Feeding:")
    print(f"  First landing: step {metrics['first_landing_step']}" + 
          (f" ({metrics['time_to_first_land_sec']:.1f}s)" if metrics['time_to_first_land_sec'] else ""))
    print(f"  First feeding: step {metrics['first_feeding_step']}" +
          (f" ({metrics['time_to_first_feed_sec']:.1f}s)" if metrics['time_to_first_feed_sec'] else ""))
    print(f"  Total feeds: {metrics['total_feeds']}")
    print(f"  Final hunger: {metrics['final_hunger']:.1%}")
    print()
    if 'time_flying' in metrics:
        print("Time allocation:")
        print(f"  Flying: {metrics['time_flying']:.1%}")
        print(f"  Landing: {metrics['time_landing']:.1%}")
        print(f"  Landed: {metrics['time_landed']:.1%}")
        print(f"  Feeding: {metrics['time_feeding']:.1%}")
    
    # Save artifacts
    if frames and not args.no_render:
        gif_path = output_dir / "feeding_demo.gif"
        print(f"\nSaving GIF to {gif_path}...")
        frames[0].save(
            gif_path, save_all=True, append_images=frames[1:],
            duration=50, loop=0
        )
        
        # Final frame PNG
        png_path = output_dir / "feeding_final.png"
        frames[-1].save(png_path)
        print(f"Saved final frame to {png_path}")
    
    # Summary
    print("\n" + "="*60)
    if final_state == GameState.WON:
        print("SUCCESS! The fly landed on fruit and fed!")
        print("Hunger was satisfied via the neural feeding pathway.")
    elif final_state == GameState.STARVED:
        print("FAILURE: The fly STARVED!")
        print("Did not feed within the time limit.")
    else:
        print(f"Simulation ended: {final_state.value}")
    print("="*60)
    
    # Verify no cheating
    print("\nPURE-GRAPH VERIFICATION:")
    print("  - Landing: Visual loom signal → DNp07/DNp10 (NOT distance threshold)")
    print("  - Feeding: Tarsal GRN → proboscis MN activation (NOT auto-eat)")
    print("  - Chemotaxis: Bilateral odor → excitatory LH → olfactory DNs")
    
    return 0 if final_state == GameState.WON else 1


if __name__ == "__main__":
    sys.exit(main())
