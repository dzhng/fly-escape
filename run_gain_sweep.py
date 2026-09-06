#!/usr/bin/env python3
"""
Gain sweep experiment for landing + feeding behavior.

Tests how FEEDING GAIN and OLFACTORY GAIN affect:
- Time to first landing
- Time to first successful feed
- Survival rate (before 5-minute starvation)

SCIENTIFIC HONESTY NOTE:
- FEEDING GAIN affects sugar→proboscis pathway (POST-CONTACT)
  → Should affect feeding initiation, NOT landing speed
- OLFACTORY GAIN affects hunger→approach motivation (PRE-CONTACT)
  → Should affect landing speed (via stronger chemotaxis)

If feeding_gain speeds landing, that's suspicious (it shouldn't).
If olfactory_gain speeds landing, that's biologically plausible.

Usage:
    python run_gain_sweep.py                      # Full sweep (slow)
    python run_gain_sweep.py --quick              # Quick test (fewer seeds)
    python run_gain_sweep.py --feeding-only       # Only sweep feeding gain
    python run_gain_sweep.py --olfactory-only     # Only sweep olfactory gain
"""

import argparse
import sys
import json
import csv
from pathlib import Path
import numpy as np
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent / "src"))

from graph_loader import MaleCNSGraph
from feeding_maze_sim import (
    FeedingMazeSimulator, GameState,
    create_feeding_level, create_survival_level,
)


def run_single_experiment(
    graph: MaleCNSGraph,
    seed: int,
    feeding_gain: float,
    olfactory_gain: float,
    level_name: str = "easy",  # Default to easy level for faster runs
    max_steps: int = 2000,     # Limit steps to speed up
    verbose: bool = False,     # Suppress verbose output
) -> dict:
    """Run a single experiment with given parameters."""
    import io
    import sys
    
    # Create level - suppress verbose output
    old_stdout = sys.stdout
    if not verbose:
        sys.stdout = io.StringIO()
    
    try:
        if level_name == "survival":
            from feeding_maze_sim import create_survival_level
            maze = create_survival_level()
        elif level_name == "easy":
            from feeding_maze_sim import create_easy_level
            maze = create_easy_level()
        else:
            maze = create_feeding_level()
        
        # Limit time
        maze.time_limit = min(maze.time_limit, max_steps)
        
        # Create simulator
        sim = FeedingMazeSimulator(
            graph=graph,
            maze=maze,
            seed=seed,
            odor_current=5.0,
            starve_time_steps=3000,  # 5 minutes
            feeding_gain=feeding_gain,
            olfactory_gain=olfactory_gain,
        )
    finally:
        if not verbose:
            sys.stdout = old_stdout
    
    # Run simulation
    result = sim.run_until_done(max_steps=max_steps)
    metrics = sim.get_metrics()
    
    return {
        "seed": seed,
        "feeding_gain": feeding_gain,
        "olfactory_gain": olfactory_gain,
        "final_state": metrics["final_state"],
        "survived": metrics["final_state"] == "won",
        "first_landing_step": metrics["first_landing_step"],
        "first_feeding_step": metrics["first_feeding_step"],
        "time_to_land_sec": metrics.get("time_to_first_land_sec"),
        "time_to_feed_sec": metrics.get("time_to_first_feed_sec"),
        "total_feeds": metrics["total_feeds"],
        "total_steps": metrics["total_steps"],
    }


def run_sweep(
    graph: MaleCNSGraph,
    feeding_gains: list,
    olfactory_gains: list,
    seeds: list,
    level_name: str = "easy",
    verbose: bool = True,
    max_steps: int = 2000,
) -> list:
    """Run full sweep across all gain × seed combinations."""
    
    results = []
    total = len(feeding_gains) * len(olfactory_gains) * len(seeds)
    count = 0
    
    for fg in feeding_gains:
        for og in olfactory_gains:
            for seed in seeds:
                count += 1
                if verbose:
                    print(f"  [{count}/{total}] fg={fg}x, og={og}x, seed={seed}...", end="", flush=True)
                
                result = run_single_experiment(
                    graph, seed, fg, og, level_name,
                    max_steps=max_steps, verbose=False,
                )
                results.append(result)
                
                if verbose:
                    status = "✓" if result["survived"] else "✗"
                    land = result["time_to_land_sec"]
                    land_str = f"land={land:.1f}s" if land else "no land"
                    print(f" {status} {land_str}")
    
    return results


def aggregate_results(results: list) -> dict:
    """Aggregate results by gain level."""
    
    by_feeding_gain = defaultdict(list)
    by_olfactory_gain = defaultdict(list)
    by_both = defaultdict(list)
    
    for r in results:
        fg = r["feeding_gain"]
        og = r["olfactory_gain"]
        
        by_feeding_gain[fg].append(r)
        by_olfactory_gain[og].append(r)
        by_both[(fg, og)].append(r)
    
    def summarize(group: list) -> dict:
        n = len(group)
        survived = sum(1 for r in group if r["survived"])
        
        land_times = [r["time_to_land_sec"] for r in group if r["time_to_land_sec"]]
        feed_times = [r["time_to_feed_sec"] for r in group if r["time_to_feed_sec"]]
        
        return {
            "n_trials": n,
            "survival_rate": survived / n if n > 0 else 0,
            "n_survived": survived,
            "n_landed": len(land_times),
            "n_fed": len(feed_times),
            "mean_land_time": np.mean(land_times) if land_times else None,
            "std_land_time": np.std(land_times) if len(land_times) > 1 else None,
            "mean_feed_time": np.mean(feed_times) if feed_times else None,
            "std_feed_time": np.std(feed_times) if len(feed_times) > 1 else None,
        }
    
    return {
        "by_feeding_gain": {k: summarize(v) for k, v in sorted(by_feeding_gain.items())},
        "by_olfactory_gain": {k: summarize(v) for k, v in sorted(by_olfactory_gain.items())},
        "by_both": {f"fg{k[0]}_og{k[1]}": summarize(v) for k, v in sorted(by_both.items())},
    }


def generate_report(results: list, aggregated: dict, output_dir: Path) -> str:
    """Generate markdown report with tables."""
    
    report = []
    report.append("# Gain Sweep Report: Landing + Feeding Behavior")
    report.append(f"\nGenerated: {datetime.now().isoformat()}")
    report.append(f"\nTotal trials: {len(results)}")
    
    report.append("\n## Scientific Honesty Note")
    report.append("""
**FEEDING GAIN** affects the sugar→proboscis pathway (POST-CONTACT).
- This should affect feeding initiation speed
- It should **NOT** significantly affect landing speed

**OLFACTORY GAIN** affects hunger→approach motivation (PRE-CONTACT).
- This amplifies chemotaxis drive when hungry
- It **SHOULD** affect landing speed (fly approaches faster)

If feeding_gain speeds landing, that would be suspicious.
If olfactory_gain speeds landing, that's biologically plausible.
""")
    
    # Feeding gain table
    report.append("\n## Effect of Feeding Gain (sugar→proboscis pathway)")
    report.append("\n| Feeding Gain | Survival | Mean Land Time | Mean Feed Time | N Landed | N Fed |")
    report.append("|--------------|----------|----------------|----------------|----------|-------|")
    
    for gain, stats in aggregated["by_feeding_gain"].items():
        surv = f"{stats['survival_rate']:.0%}"
        land = f"{stats['mean_land_time']:.1f}s ± {stats['std_land_time']:.1f}" if stats['mean_land_time'] else "N/A"
        feed = f"{stats['mean_feed_time']:.1f}s ± {stats['std_feed_time']:.1f}" if stats['mean_feed_time'] else "N/A"
        report.append(f"| {gain}x | {surv} | {land} | {feed} | {stats['n_landed']} | {stats['n_fed']} |")
    
    # Olfactory gain table
    report.append("\n## Effect of Olfactory Gain (hunger→approach motivation)")
    report.append("\n| Olfactory Gain | Survival | Mean Land Time | Mean Feed Time | N Landed | N Fed |")
    report.append("|----------------|----------|----------------|----------------|----------|-------|")
    
    for gain, stats in aggregated["by_olfactory_gain"].items():
        surv = f"{stats['survival_rate']:.0%}"
        land = f"{stats['mean_land_time']:.1f}s ± {stats['std_land_time']:.1f}" if stats['mean_land_time'] else "N/A"
        feed = f"{stats['mean_feed_time']:.1f}s ± {stats['std_feed_time']:.1f}" if stats['mean_feed_time'] else "N/A"
        report.append(f"| {gain}x | {surv} | {land} | {feed} | {stats['n_landed']} | {stats['n_fed']} |")
    
    # Interpretation
    report.append("\n## Interpretation")
    
    # Check if feeding gain affects landing (it shouldn't!)
    fg_stats = aggregated["by_feeding_gain"]
    fg_land_times = [(g, s["mean_land_time"]) for g, s in fg_stats.items() if s["mean_land_time"]]
    
    if len(fg_land_times) >= 2:
        fg_sorted = sorted(fg_land_times)
        low_gain_land = fg_sorted[0][1]
        high_gain_land = fg_sorted[-1][1]
        
        if low_gain_land and high_gain_land:
            diff_pct = (low_gain_land - high_gain_land) / low_gain_land * 100
            
            if abs(diff_pct) < 10:
                report.append(f"\n**Feeding gain does NOT significantly affect landing speed** ({diff_pct:.1f}% difference).")
                report.append("This is expected: feeding gain only affects post-contact sugar pathway.")
            else:
                report.append(f"\n**WARNING: Feeding gain appears to affect landing speed** ({diff_pct:.1f}% difference).")
                report.append("This is unexpected and may indicate a bug or confounding factor.")
    
    # Check if olfactory gain affects landing (it should!)
    og_stats = aggregated["by_olfactory_gain"]
    og_land_times = [(g, s["mean_land_time"]) for g, s in og_stats.items() if s["mean_land_time"]]
    
    if len(og_land_times) >= 2:
        og_sorted = sorted(og_land_times)
        low_gain_land = og_sorted[0][1]
        high_gain_land = og_sorted[-1][1]
        
        if low_gain_land and high_gain_land:
            diff_pct = (low_gain_land - high_gain_land) / low_gain_land * 100
            
            if diff_pct > 10:
                report.append(f"\n**Olfactory gain speeds landing** ({diff_pct:.1f}% faster with high gain).")
                report.append("This is biologically plausible: hungry flies are more motivated to approach food.")
            else:
                report.append(f"\n**Olfactory gain has weak/no effect on landing speed** ({diff_pct:.1f}% difference).")
                report.append("The effect may be masked by other factors (noise, boundary reflections).")
    
    report.append("\n## Raw Data")
    report.append("\nSee `gain_sweep_results.csv` for full trial data.")
    
    return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(description="Run gain sweep experiment")
    parser.add_argument("--data-dir", type=str, default="data", help="Path to connectome data")
    parser.add_argument("--output-dir", type=str, default="artifacts", help="Output directory")
    parser.add_argument("--quick", action="store_true", help="Quick test (fewer seeds)")
    parser.add_argument("--feeding-only", action="store_true", help="Only sweep feeding gain")
    parser.add_argument("--olfactory-only", action="store_true", help="Only sweep olfactory gain")
    parser.add_argument("--level", type=str, default="easy", choices=["easy", "feeding", "survival"],
                        help="Level to test on (easy=fast, feeding=medium, survival=hard)")
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print("="*60)
    print("GAIN SWEEP EXPERIMENT: Landing + Feeding")
    print("="*60)
    
    # Define sweep parameters
    if args.quick:
        seeds = [42, 123, 456]
        feeding_gains = [1.0, 2.0, 4.0]
        olfactory_gains = [1.0, 2.0, 4.0]
    else:
        seeds = [42, 123, 456, 789, 999]
        feeding_gains = [0.5, 1.0, 2.0, 4.0, 8.0]
        olfactory_gains = [0.5, 1.0, 2.0, 4.0, 8.0]
    
    if args.feeding_only:
        olfactory_gains = [1.0]  # Default
    elif args.olfactory_only:
        feeding_gains = [2.0]  # Default
    
    print(f"\nSweep parameters:")
    print(f"  Seeds: {seeds}")
    print(f"  Feeding gains: {feeding_gains}")
    print(f"  Olfactory gains: {olfactory_gains}")
    print(f"  Level: {args.level}")
    print(f"  Total trials: {len(seeds) * len(feeding_gains) * len(olfactory_gains)}")
    
    # Load connectome
    print("\nLoading MaleCNS connectome...")
    graph = MaleCNSGraph(args.data_dir)
    graph.load()
    graph.extract_motor1hop()
    
    # Run sweep
    print("\nRunning sweep...")
    results = run_sweep(
        graph,
        feeding_gains=feeding_gains,
        olfactory_gains=olfactory_gains,
        seeds=seeds,
        level_name=args.level,
        verbose=True,
    )
    
    # Aggregate
    print("\nAggregating results...")
    aggregated = aggregate_results(results)
    
    # Save raw results as CSV
    csv_path = output_dir / "gain_sweep_results.csv"
    with open(csv_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
    print(f"  Saved raw results to {csv_path}")
    
    # Save JSON
    json_path = output_dir / "gain_sweep_aggregated.json"
    with open(json_path, 'w') as f:
        json.dump(aggregated, f, indent=2, default=str)
    print(f"  Saved aggregated results to {json_path}")
    
    # Generate report
    report = generate_report(results, aggregated, output_dir)
    report_path = output_dir / "gain_sweep_report.md"
    with open(report_path, 'w') as f:
        f.write(report)
    print(f"  Saved report to {report_path}")
    
    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    print("\nFeeding Gain → Landing Time:")
    for gain, stats in aggregated["by_feeding_gain"].items():
        land = f"{stats['mean_land_time']:.1f}s" if stats['mean_land_time'] else "N/A"
        print(f"  {gain}x: {land} ({stats['survival_rate']:.0%} survival)")
    
    print("\nOlfactory Gain → Landing Time:")
    for gain, stats in aggregated["by_olfactory_gain"].items():
        land = f"{stats['mean_land_time']:.1f}s" if stats['mean_land_time'] else "N/A"
        print(f"  {gain}x: {land} ({stats['survival_rate']:.0%} survival)")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
