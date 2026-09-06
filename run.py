#!/usr/bin/env python3
"""
Fly Maze - MaleCNS LIF Simulation

PURE GRAPH-BASED CHEMOTAXIS - No external turn bias.
The fly brain (MaleCNS connectome) IS the AI.

Bilateral odor sensing → asymmetric ORN/PN injection → graph dynamics → motor output

Usage:
    python run.py                    # Run both conditions
    python run.py --baseline-only    # Run only baseline
    python run.py --fruit-only       # Run only fruit condition
    python run.py --download         # Download data only
"""

import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from scripts.download_connectome import main as download_data


def main():
    parser = argparse.ArgumentParser(description="MaleCNS Fly Arena Simulation (PURE LIF)")
    parser.add_argument("--download", action="store_true", help="Download connectome data only")
    parser.add_argument("--baseline-only", action="store_true", help="Run only baseline (no odor)")
    parser.add_argument("--fruit-only", action="store_true", help="Run only fruit odor condition")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--steps", type=int, default=1500, help="Number of simulation steps")
    parser.add_argument("--output", type=str, default="artifacts", help="Output directory")
    parser.add_argument("--current", type=float, default=2.0, help="Odor injection base current")
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
    from src.simulation import SimulationConfig, run_simulation, save_results
    from src.visualization import plot_path_comparison
    from src.arena import OdorSource
    
    print("\n" + "="*60)
    print("PURE GRAPH-BASED CHEMOTAXIS TEST")
    print("NO external turn bias - fly brain is the AI")
    print("="*60)
    
    print("\nLoading MaleCNS connectome...")
    graph = MaleCNSGraph(data_dir)
    graph.load()
    graph.extract_motor1hop()
    
    config = SimulationConfig(
        n_steps=args.steps,
        seed=args.seed,
        save_every=2,
        arena_width=400.0,
        arena_height=400.0,
        fly_start_x=80.0,
        fly_start_y=200.0,
        fly_start_theta=0.0,
        fruit_x=320.0,
        fruit_y=200.0,
        fruit_intensity=1.0,
        fruit_sigma=100.0,
        odor_base_current=args.current,
    )
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    arena_baseline = None
    arena_fruit = None
    metrics_baseline = None
    metrics_fruit = None
    
    if not args.fruit_only:
        print("\n" + "="*60)
        print("BASELINE RUN: Empty sterile arena (no odor)")
        print("="*60)
        
        arena_baseline, thrusts_baseline, turns_baseline, frames_baseline = run_simulation(
            graph,
            config,
            with_odor=False,
            title_suffix="— empty sterile arena",
        )
        
        save_results(arena_baseline, thrusts_baseline, turns_baseline, frames_baseline, output_dir, "baseline")
    
    if not args.baseline_only:
        print("\n" + "="*60)
        print("FRUIT RUN: Arena with fruit odor (PURE LIF)")
        print("="*60)
        
        arena_fruit, thrusts_fruit, turns_fruit, frames_fruit = run_simulation(
            graph,
            config,
            with_odor=True,
            title_suffix="— fruit arena (pure LIF)",
        )
        
        save_results(arena_fruit, thrusts_fruit, turns_fruit, frames_fruit, output_dir, "fruit")
        metrics_fruit = arena_fruit.compute_metrics(0)
    
    if arena_baseline and arena_fruit:
        print("\n" + "="*60)
        print("PURE GRAPH CHEMOTAXIS RESULTS")
        print("="*60)
        
        # Add fruit marker to baseline for metric computation
        fruit_source = OdorSource(
            x=config.fruit_x,
            y=config.fruit_y,
            intensity=config.fruit_intensity,
            sigma=config.fruit_sigma,
        )
        arena_baseline.odor_sources = [fruit_source]
        metrics_baseline = arena_baseline.compute_metrics(0)
        
        print("\nChemotaxis Metrics (PURE LIF - no external bias):")
        print("-" * 50)
        print(f"{'Metric':<25} {'Baseline':>12} {'With Fruit':>12}")
        print("-" * 50)
        print(f"{'Mean dist to fruit':<25} {metrics_baseline['mean_distance']:>12.1f} {metrics_fruit['mean_distance']:>12.1f}")
        print(f"{'Final dist to fruit':<25} {metrics_baseline['final_distance']:>12.1f} {metrics_fruit['final_distance']:>12.1f}")
        print(f"{'Min dist to fruit':<25} {metrics_baseline['min_distance']:>12.1f} {metrics_fruit['min_distance']:>12.1f}")
        print(f"{'Heading alignment':<25} {metrics_baseline['mean_heading_alignment']:>12.3f} {metrics_fruit['mean_heading_alignment']:>12.3f}")
        print(f"{'Path length':<25} {metrics_baseline['path_length']:>12.1f} {metrics_fruit['path_length']:>12.1f}")
        print("-" * 50)
        
        improvement = metrics_baseline['mean_distance'] - metrics_fruit['mean_distance']
        alignment_diff = metrics_fruit['mean_heading_alignment'] - metrics_baseline['mean_heading_alignment']
        
        print(f"\nChemotaxis effect (PURE GRAPH):")
        print(f"  Distance improvement: {improvement:.1f} units closer to fruit")
        print(f"  Heading alignment improvement: {alignment_diff:.3f}")
        
        if improvement > 20:
            print("  → STRONG chemotaxis from graph dynamics!")
        elif improvement > 5:
            print("  → MODERATE chemotaxis effect")
        elif improvement > 0:
            print("  → WEAK but present chemotaxis effect")
        else:
            print("  → NO clear chemotaxis effect (needs tuning)")
        
        comparison_path = output_dir / "comparison_pure_lif.png"
        plot_path_comparison(
            arena_baseline,
            arena_fruit,
            metrics_baseline,
            metrics_fruit,
            comparison_path,
        )
        print(f"\nSaved comparison plot: {comparison_path}")
        
        # Save honest metrics report
        report = {
            "method": "PURE_GRAPH_LIF",
            "external_turn_bias": False,
            "bilateral_injection": True,
            "seed": args.seed,
            "steps": args.steps,
            "odor_base_current": args.current,
            "baseline_metrics": metrics_baseline,
            "fruit_metrics": metrics_fruit,
            "improvement": {
                "mean_distance": improvement,
                "heading_alignment": alignment_diff,
            },
            "assessment": "STRONG" if improvement > 20 else "MODERATE" if improvement > 5 else "WEAK" if improvement > 0 else "NONE",
        }
        
        report_path = output_dir / "pure_lif_report.json"
        import json
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"Saved metrics report: {report_path}")
    
    print("\n" + "="*60)
    print("DONE! Artifacts saved to:", output_dir)
    print("="*60)
    print("\nFiles:")
    for f in sorted(output_dir.glob("*")):
        print(f"  {f.name}")


if __name__ == "__main__":
    main()
