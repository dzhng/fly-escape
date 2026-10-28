#!/usr/bin/env python3
"""
WARMUP SWEEP EXPERIMENT: Does neuron warmup tick count affect attraction/repulsion strength?

QUESTION: Does warming up MORE make attract/repel STRONGER?

PROTOCOL:
- Sweep warmup ∈ {0, 30, 60, 120} ticks
- For each warmup, run paired A/B tests:
  1. Fruit (excitatory attract) vs empty control
  2. Vinegar (inhibitory repel) vs empty control
- Use 15-30 seeds per condition for statistical power
- Pure-graph chemotaxis only (no hacks)

METRICS:
- mean_distance: Mean distance to stimulus over trial
- distance_reduction: (initial_dist - final_dist) / initial_dist
- time_in_zone: Fraction of time within 1-sigma of stimulus
- closest_approach: Minimum distance reached
- effect_size: Cohen's d vs control

OUTPUT:
- JSON evidence file with all metrics
- Markdown summary report
"""

import sys
import json
import argparse
import numpy as np
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import io
from contextlib import redirect_stdout

sys.path.insert(0, str(Path(__file__).parent / "src"))


@dataclass
class TrialConfig:
    """Configuration for a single trial."""
    warmup_ticks: int
    seed: int
    stimulus_type: str  # "fruit", "vinegar", or "empty"
    arena_width: float = 400.0
    arena_height: float = 300.0
    fly_start_x: float = 80.0
    fly_start_y: float = 150.0
    fly_start_theta: float = 0.0  # Facing right
    stimulus_x: float = 320.0
    stimulus_y: float = 150.0
    stimulus_intensity: float = 1.0
    stimulus_sigma: float = 60.0
    trial_ticks: int = 600  # After warmup
    odor_current: float = 5.0


@dataclass
class TrialResult:
    """Result of a single trial."""
    mean_distance: float
    final_distance: float
    initial_distance: float
    distance_reduction: float
    time_in_zone: float
    closest_approach: float
    mean_thrust: float
    mean_turn: float


@dataclass
class OdorSource:
    """Simple odor source for concentration computation."""
    x: float
    y: float
    intensity: float
    sigma: float
    
    def concentration(self, px: float, py: float) -> float:
        d2 = (px - self.x) ** 2 + (py - self.y) ** 2
        return self.intensity * np.exp(-d2 / (2 * self.sigma ** 2))


def run_trial(lif, olfactory, config: TrialConfig, fruit_blend, vinegar_blend) -> TrialResult:
    """Run a single trial with specified warmup and stimulus."""
    
    # Reset LIF state
    lif.reset(config.seed)
    
    # Build odor source if not empty
    odor_source = None
    if config.stimulus_type in ["fruit", "vinegar"]:
        odor_source = OdorSource(
            x=config.stimulus_x,
            y=config.stimulus_y,
            intensity=config.stimulus_intensity,
            sigma=config.stimulus_sigma,
        )
    
    # === WARMUP PHASE ===
    # Run LIF simulation without odor input to stabilize neural dynamics
    for _ in range(config.warmup_ticks):
        lif.step()
    
    # === TRIAL PHASE ===
    # Initialize fly position
    x = config.fly_start_x
    y = config.fly_start_y
    theta = config.fly_start_theta
    vx = 0.0
    vy = 0.0
    
    # Flight dynamics parameters
    max_speed = 3.0
    drag = 0.05
    thrust_gain = 0.15
    turn_gain = 0.08
    
    # Recording
    thrusts = []
    turns = []
    distances = []
    
    initial_dist = np.sqrt((x - config.stimulus_x)**2 + (y - config.stimulus_y)**2)
    
    for t in range(config.trial_ticks):
        # Compute odor injection
        currents = {}
        if config.stimulus_type == "fruit" and odor_source:
            currents = olfactory.get_bilateral_odor_currents(
                fly_x=x, fly_y=y, fly_theta=theta,
                odor_sources=[odor_source],
                odor_blend=fruit_blend,
                base_current=config.odor_current,
            )
        elif config.stimulus_type == "vinegar" and odor_source:
            currents = olfactory.get_bilateral_aversive_currents(
                fly_x=x, fly_y=y, fly_theta=theta,
                odor_sources=[odor_source],
                odor_blend=vinegar_blend,
                base_current=config.odor_current,
            )
        
        lif.set_external_current(currents)
        spikes, _, _ = lif.step()
        
        # Compute motor output
        thrust, turn = lif.compute_flight_motor_output()
        thrusts.append(thrust)
        turns.append(turn)
        
        # Update velocity with physics
        vx += thrust_gain * thrust * np.cos(theta)
        vy += thrust_gain * thrust * np.sin(theta)
        vx *= (1.0 - drag)
        vy *= (1.0 - drag)
        
        speed = np.sqrt(vx**2 + vy**2)
        if speed > max_speed:
            scale = max_speed / speed
            vx *= scale
            vy *= scale
        
        # Update heading
        theta += turn * turn_gain
        theta = (theta + np.pi) % (2 * np.pi) - np.pi
        
        # Update position
        x += vx
        y += vy
        
        # Boundary clamp
        x = np.clip(x, 5, config.arena_width - 5)
        y = np.clip(y, 5, config.arena_height - 5)
        
        # Distance to stimulus
        dist = np.sqrt((x - config.stimulus_x)**2 + (y - config.stimulus_y)**2)
        distances.append(dist)
    
    # Compute metrics
    distances = np.array(distances)
    mean_distance = float(np.mean(distances))
    final_distance = float(distances[-1]) if len(distances) > 0 else initial_dist
    closest_approach = float(np.min(distances)) if len(distances) > 0 else initial_dist
    distance_reduction = (initial_dist - final_distance) / initial_dist if initial_dist > 0 else 0
    
    # Time in zone (within 1 sigma of stimulus)
    in_zone = distances < config.stimulus_sigma
    time_in_zone = float(np.mean(in_zone))
    
    return TrialResult(
        mean_distance=mean_distance,
        final_distance=final_distance,
        initial_distance=initial_dist,
        distance_reduction=distance_reduction,
        time_in_zone=time_in_zone,
        closest_approach=closest_approach,
        mean_thrust=float(np.mean(thrusts)),
        mean_turn=float(np.mean(turns)),
    )


def cohens_d(group1: List[float], group2: List[float]) -> float:
    """Compute Cohen's d effect size."""
    n1, n2 = len(group1), len(group2)
    if n1 < 2 or n2 < 2:
        return 0.0
    m1, m2 = np.mean(group1), np.mean(group2)
    s1, s2 = np.std(group1, ddof=1), np.std(group2, ddof=1)
    pooled_std = np.sqrt(((n1-1)*s1**2 + (n2-1)*s2**2) / (n1+n2-2))
    if pooled_std < 1e-6:
        return 0.0
    return (m1 - m2) / pooled_std


def main():
    parser = argparse.ArgumentParser(description="Warmup sweep experiment")
    parser.add_argument("--data-dir", type=str, default="data")
    parser.add_argument("--output-dir", type=str, default="specs/help-the-fly-escape/assets/evidence")
    parser.add_argument("--seeds", type=int, default=20, help="Number of seeds per condition")
    parser.add_argument("--warmups", type=str, default="0,30,60,120", help="Comma-separated warmup values")
    parser.add_argument("--trial-ticks", type=int, default=600, help="Trial duration in ticks")
    args = parser.parse_args()
    
    warmup_values = [int(w) for w in args.warmups.split(",")]
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 70)
    print("WARMUP SWEEP EXPERIMENT")
    print("=" * 70)
    print(f"Question: Does longer warmup strengthen attract/repel effects?")
    print(f"Warmup values: {warmup_values}")
    print(f"Seeds per condition: {args.seeds}")
    print(f"Trial ticks: {args.trial_ticks}")
    print()
    
    # Load connectome with suppressed output
    print("Loading MaleCNS connectome...", flush=True)
    
    from graph_loader import MaleCNSGraph
    from lif_sim import LIFSimulator, LIFParams
    from olfaction import BilateralOlfactoryInjector, FRUIT_ESTER_BLEND, VINEGAR_BLEND
    
    graph = MaleCNSGraph(args.data_dir)
    graph.load()
    graph.extract_motor1hop()
    
    # Initialize LIF and olfactory once (reuse across trials)
    print("Initializing LIF simulator...", flush=True)
    params = LIFParams()
    lif = LIFSimulator(
        adjacency=graph.adjacency,
        body_to_idx=graph.body_to_idx,
        idx_to_body=graph.idx_to_body,
        params=params,
        seed=42,
    )
    lif.set_motor_neurons(graph.dn_bodies, graph.mn_bodies, graph)
    
    # Suppress olfactory initialization output
    f = io.StringIO()
    with redirect_stdout(f):
        olfactory = BilateralOlfactoryInjector(graph.annotations, graph.body_to_idx)
    print("LIF and olfactory systems ready.")
    print()
    
    # Results storage
    results = {
        "meta": {
            "warmup_values": warmup_values,
            "seeds": args.seeds,
            "trial_ticks": args.trial_ticks,
            "stimulus_conditions": ["fruit", "vinegar", "empty"],
        },
        "trials": [],
        "summary": {},
    }
    
    # Run all trials
    total_trials = len(warmup_values) * 3 * args.seeds  # warmup × stimulus × seeds
    trial_count = 0
    
    all_metrics = defaultdict(lambda: defaultdict(list))  # [warmup][stimulus] -> list of metrics
    
    for warmup in warmup_values:
        print(f"--- Warmup = {warmup} ticks ---", flush=True)
        
        for stimulus in ["fruit", "vinegar", "empty"]:
            print(f"  {stimulus}: ", end="", flush=True)
            
            for seed in range(args.seeds):
                config = TrialConfig(
                    warmup_ticks=warmup,
                    seed=seed,
                    stimulus_type=stimulus,
                    trial_ticks=args.trial_ticks,
                )
                
                result = run_trial(lif, olfactory, config, FRUIT_ESTER_BLEND, VINEGAR_BLEND)
                
                # Store abbreviated trial info
                results["trials"].append({
                    "warmup": warmup,
                    "stimulus": stimulus,
                    "seed": seed,
                    "mean_distance": result.mean_distance,
                    "distance_reduction": result.distance_reduction,
                    "time_in_zone": result.time_in_zone,
                    "closest_approach": result.closest_approach,
                })
                
                # Store for summary computation
                all_metrics[warmup][stimulus].append({
                    "mean_distance": result.mean_distance,
                    "distance_reduction": result.distance_reduction,
                    "time_in_zone": result.time_in_zone,
                    "closest_approach": result.closest_approach,
                })
                
                trial_count += 1
                if (seed + 1) % 5 == 0:
                    print(".", end="", flush=True)
            
            print(f" done ({args.seeds} seeds)", flush=True)
    
    print()
    
    # Compute summary statistics
    print("=" * 70)
    print("SUMMARY STATISTICS")
    print("=" * 70)
    
    summary = {}
    for warmup in warmup_values:
        summary[f"warmup_{warmup}"] = {}
        
        for stimulus in ["fruit", "vinegar", "empty"]:
            metrics = all_metrics[warmup][stimulus]
            
            mean_dist = [m["mean_distance"] for m in metrics]
            dist_red = [m["distance_reduction"] for m in metrics]
            time_zone = [m["time_in_zone"] for m in metrics]
            closest = [m["closest_approach"] for m in metrics]
            
            summary[f"warmup_{warmup}"][stimulus] = {
                "mean_distance": {"mean": float(np.mean(mean_dist)), "std": float(np.std(mean_dist))},
                "distance_reduction": {"mean": float(np.mean(dist_red)), "std": float(np.std(dist_red))},
                "time_in_zone": {"mean": float(np.mean(time_zone)), "std": float(np.std(time_zone))},
                "closest_approach": {"mean": float(np.mean(closest)), "std": float(np.std(closest))},
            }
        
        # Effect sizes vs control
        control_dist = [m["mean_distance"] for m in all_metrics[warmup]["empty"]]
        
        fruit_dist = [m["mean_distance"] for m in all_metrics[warmup]["fruit"]]
        vinegar_dist = [m["mean_distance"] for m in all_metrics[warmup]["vinegar"]]
        
        # For fruit: expect LOWER mean distance (attracting)
        # Effect size: control - fruit (positive = fruit attracts)
        fruit_effect = cohens_d(control_dist, fruit_dist)
        
        # For vinegar: expect HIGHER mean distance (repelling)
        # Effect size: vinegar - control (positive = vinegar repels)
        vinegar_effect = cohens_d(vinegar_dist, control_dist)
        
        summary[f"warmup_{warmup}"]["fruit_vs_control_effect_d"] = fruit_effect
        summary[f"warmup_{warmup}"]["vinegar_vs_control_effect_d"] = vinegar_effect
    
    results["summary"] = summary
    
    # Print fruit attraction table
    print("\n### FRUIT ATTRACTION (warmup × metric)")
    print("| Warmup | Mean Distance | Δ vs Control | Effect Size (d) |")
    print("|--------|---------------|--------------|-----------------|")
    for warmup in warmup_values:
        fruit_mean = summary[f"warmup_{warmup}"]["fruit"]["mean_distance"]["mean"]
        control_mean = summary[f"warmup_{warmup}"]["empty"]["mean_distance"]["mean"]
        effect_d = summary[f"warmup_{warmup}"]["fruit_vs_control_effect_d"]
        delta = control_mean - fruit_mean
        print(f"| {warmup:6d} | {fruit_mean:13.1f} | {delta:+12.1f} | {effect_d:15.2f} |")
    
    # Print vinegar repulsion table
    print("\n### VINEGAR REPULSION (warmup × metric)")
    print("| Warmup | Mean Distance | Δ vs Control | Effect Size (d) |")
    print("|--------|---------------|--------------|-----------------|")
    for warmup in warmup_values:
        vinegar_mean = summary[f"warmup_{warmup}"]["vinegar"]["mean_distance"]["mean"]
        control_mean = summary[f"warmup_{warmup}"]["empty"]["mean_distance"]["mean"]
        effect_d = summary[f"warmup_{warmup}"]["vinegar_vs_control_effect_d"]
        delta = vinegar_mean - control_mean
        print(f"| {warmup:6d} | {vinegar_mean:13.1f} | {delta:+12.1f} | {effect_d:15.2f} |")
    
    # Detailed metrics table
    print("\n### DETAILED METRICS BY WARMUP")
    print("\n#### Distance Reduction (higher = more approach)")
    print("| Warmup | Fruit | Vinegar | Control |")
    print("|--------|-------|---------|---------|")
    for warmup in warmup_values:
        f = summary[f"warmup_{warmup}"]["fruit"]["distance_reduction"]["mean"]
        v = summary[f"warmup_{warmup}"]["vinegar"]["distance_reduction"]["mean"]
        c = summary[f"warmup_{warmup}"]["empty"]["distance_reduction"]["mean"]
        print(f"| {warmup:6d} | {f:5.2f} | {v:7.2f} | {c:7.2f} |")
    
    print("\n#### Time in Zone (fraction, higher = more time near stimulus)")
    print("| Warmup | Fruit | Vinegar | Control |")
    print("|--------|-------|---------|---------|")
    for warmup in warmup_values:
        f = summary[f"warmup_{warmup}"]["fruit"]["time_in_zone"]["mean"]
        v = summary[f"warmup_{warmup}"]["vinegar"]["time_in_zone"]["mean"]
        c = summary[f"warmup_{warmup}"]["empty"]["time_in_zone"]["mean"]
        print(f"| {warmup:6d} | {f:5.2f} | {v:7.2f} | {c:7.2f} |")
    
    print("\n#### Closest Approach (lower = got closer)")
    print("| Warmup | Fruit | Vinegar | Control |")
    print("|--------|-------|---------|---------|")
    for warmup in warmup_values:
        f = summary[f"warmup_{warmup}"]["fruit"]["closest_approach"]["mean"]
        v = summary[f"warmup_{warmup}"]["vinegar"]["closest_approach"]["mean"]
        c = summary[f"warmup_{warmup}"]["empty"]["closest_approach"]["mean"]
        print(f"| {warmup:6d} | {f:5.1f} | {v:7.1f} | {c:7.1f} |")
    
    # ANSWER THE QUESTIONS
    print("\n" + "=" * 70)
    print("CONCLUSIONS")
    print("=" * 70)
    
    # 1. Does longer warmup strengthen attract?
    fruit_effects = [summary[f"warmup_{w}"]["fruit_vs_control_effect_d"] for w in warmup_values]
    fruit_trend = "INCREASING" if fruit_effects[-1] > fruit_effects[0] + 0.1 else (
        "DECREASING" if fruit_effects[-1] < fruit_effects[0] - 0.1 else "NO CLEAR TREND"
    )
    max_fruit_warmup = warmup_values[np.argmax(fruit_effects)]
    
    print(f"\n1. Does longer warmup strengthen ATTRACTION?")
    print(f"   Effect sizes by warmup: {dict(zip(warmup_values, [f'{e:.2f}' for e in fruit_effects]))}")
    print(f"   Trend: {fruit_trend}")
    print(f"   Strongest at warmup={max_fruit_warmup}")
    
    # 2. Does longer warmup strengthen repel?
    vinegar_effects = [summary[f"warmup_{w}"]["vinegar_vs_control_effect_d"] for w in warmup_values]
    vinegar_trend = "INCREASING" if vinegar_effects[-1] > vinegar_effects[0] + 0.1 else (
        "DECREASING" if vinegar_effects[-1] < vinegar_effects[0] - 0.1 else "NO CLEAR TREND"
    )
    max_vinegar_warmup = warmup_values[np.argmax(vinegar_effects)]
    
    print(f"\n2. Does longer warmup strengthen REPULSION?")
    print(f"   Effect sizes by warmup: {dict(zip(warmup_values, [f'{e:.2f}' for e in vinegar_effects]))}")
    print(f"   Trend: {vinegar_trend}")
    print(f"   Strongest at warmup={max_vinegar_warmup}")
    
    # 3. Is 60 "enough"?
    if len(warmup_values) >= 3:
        idx_60 = warmup_values.index(60) if 60 in warmup_values else -1
        if idx_60 >= 0:
            diminishing_fruit = abs(fruit_effects[-1] - fruit_effects[idx_60]) < 0.1
            diminishing_vinegar = abs(vinegar_effects[-1] - vinegar_effects[idx_60]) < 0.1
            
            print(f"\n3. Is warmup=60 'enough' (diminishing returns)?")
            print(f"   Fruit: {'YES' if diminishing_fruit else 'NO'} (Δd from 60→120: {fruit_effects[-1] - fruit_effects[idx_60]:.2f})")
            print(f"   Vinegar: {'YES' if diminishing_vinegar else 'NO'} (Δd from 60→120: {vinegar_effects[-1] - vinegar_effects[idx_60]:.2f})")
    
    # 4. Vinegar null at all warmups?
    all_vinegar_null = all(e < 0.2 for e in vinegar_effects)
    print(f"\n4. Is vinegar repulsion NULL at all warmups?")
    print(f"   {'YES' if all_vinegar_null else 'NO'} — max effect d={max(vinegar_effects):.2f}")
    if all_vinegar_null:
        print("   CONSISTENT WITH: Turn-DN pathway miss in ATTRACT_VS_REPEL.md")
    
    # Save results
    json_path = output_dir / "warmup_sweep_results.json"
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nEvidence saved: {json_path}")
    
    # Write markdown summary
    md_path = output_dir / "warmup_sweep_report.md"
    with open(md_path, "w") as f:
        f.write("# Warmup Sweep Experiment Results\n\n")
        f.write("## Question\n")
        f.write("Does changing neuron warmup tick count change attraction and/or repulsion effect strength?\n\n")
        f.write("## Protocol\n")
        f.write(f"- Warmup values tested: {warmup_values}\n")
        f.write(f"- Seeds per condition: {args.seeds}\n")
        f.write(f"- Trial duration: {args.trial_ticks} ticks after warmup\n")
        f.write("- Stimulus types: fruit (attract), vinegar (repel), empty (control)\n")
        f.write("- Pure graph chemotaxis (no hacks)\n\n")
        
        f.write("## Results\n\n")
        f.write("### Fruit Attraction\n")
        f.write("| Warmup | Mean Distance | Δ vs Control | Effect Size (d) |\n")
        f.write("|--------|---------------|--------------|------------------|\n")
        for warmup in warmup_values:
            fruit_mean = summary[f"warmup_{warmup}"]["fruit"]["mean_distance"]["mean"]
            control_mean = summary[f"warmup_{warmup}"]["empty"]["mean_distance"]["mean"]
            effect_d = summary[f"warmup_{warmup}"]["fruit_vs_control_effect_d"]
            delta = control_mean - fruit_mean
            f.write(f"| {warmup} | {fruit_mean:.1f} | {delta:+.1f} | {effect_d:.2f} |\n")
        
        f.write("\n### Vinegar Repulsion\n")
        f.write("| Warmup | Mean Distance | Δ vs Control | Effect Size (d) |\n")
        f.write("|--------|---------------|--------------|------------------|\n")
        for warmup in warmup_values:
            vinegar_mean = summary[f"warmup_{warmup}"]["vinegar"]["mean_distance"]["mean"]
            control_mean = summary[f"warmup_{warmup}"]["empty"]["mean_distance"]["mean"]
            effect_d = summary[f"warmup_{warmup}"]["vinegar_vs_control_effect_d"]
            delta = vinegar_mean - control_mean
            f.write(f"| {warmup} | {vinegar_mean:.1f} | {delta:+.1f} | {effect_d:.2f} |\n")
        
        f.write("\n## Conclusions\n\n")
        f.write(f"1. **Attraction trend**: {fruit_trend}\n")
        f.write(f"   - Strongest effect at warmup={max_fruit_warmup}\n")
        f.write(f"   - Effect sizes: {dict(zip(warmup_values, [f'{e:.2f}' for e in fruit_effects]))}\n\n")
        f.write(f"2. **Repulsion trend**: {vinegar_trend}\n")
        f.write(f"   - Strongest effect at warmup={max_vinegar_warmup}\n")
        f.write(f"   - Effect sizes: {dict(zip(warmup_values, [f'{e:.2f}' for e in vinegar_effects]))}\n\n")
        
        if len(warmup_values) >= 3 and 60 in warmup_values:
            idx_60 = warmup_values.index(60)
            f.write(f"3. **Is warmup=60 enough?**\n")
            f.write(f"   - Fruit: Δd from 60→120 = {fruit_effects[-1] - fruit_effects[idx_60]:.2f}\n")
            f.write(f"   - Vinegar: Δd from 60→120 = {vinegar_effects[-1] - vinegar_effects[idx_60]:.2f}\n\n")
        
        f.write(f"4. **Vinegar null at all warmups?** {'YES' if all_vinegar_null else 'NO'}\n")
        if all_vinegar_null:
            f.write("   - Consistent with turn-DN pathway miss hypothesis\n")
    
    print(f"Report saved: {md_path}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
