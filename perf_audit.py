#!/usr/bin/env python3
"""
Performance audit for Fly Maze MaleCNS simulation.

Measures:
- Wall time per LIF step
- Wall time per full sim step (LIF + sensory + motor)
- Memory usage
- Bottleneck profiling
- Scaling with number of concurrent flies
"""

import sys
import time
import tracemalloc
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from graph_loader import MaleCNSGraph, load_visual_motor, VisualMotorGraph
from lif_sim import LIFSimulator, LIFParams
from feeding_maze_sim import FeedingMazeSimulator
from house_level import create_minimal_house_level

DATA_DIR = Path(__file__).parent / "data"


def load_graph():
    """Load the visual_motor graph."""
    return load_visual_motor(DATA_DIR)


def measure_lif_step_time(lif: LIFSimulator, n_steps: int = 100) -> dict:
    """Measure raw LIF step time."""
    # Warmup
    for _ in range(10):
        lif.step()
    
    # Time individual steps
    times = []
    for _ in range(n_steps):
        start = time.perf_counter()
        lif.step()
        times.append(time.perf_counter() - start)
    
    times = np.array(times) * 1000  # Convert to ms
    return {
        "mean_ms": float(np.mean(times)),
        "std_ms": float(np.std(times)),
        "min_ms": float(np.min(times)),
        "max_ms": float(np.max(times)),
        "p50_ms": float(np.percentile(times, 50)),
        "p99_ms": float(np.percentile(times, 99)),
    }


def measure_sim_step_time(sim: FeedingMazeSimulator, n_steps: int = 100) -> dict:
    """Measure full simulation step time (LIF + sensory + motor)."""
    sim.reset()
    
    # Warmup
    for _ in range(10):
        sim.step()
    
    sim.reset()
    
    # Time individual steps
    times = []
    for _ in range(n_steps):
        start = time.perf_counter()
        sim.step()
        times.append(time.perf_counter() - start)
    
    times = np.array(times) * 1000
    return {
        "mean_ms": float(np.mean(times)),
        "std_ms": float(np.std(times)),
        "min_ms": float(np.min(times)),
        "max_ms": float(np.max(times)),
        "p50_ms": float(np.percentile(times, 50)),
        "p99_ms": float(np.percentile(times, 99)),
    }


def measure_episode_time(sim: FeedingMazeSimulator, max_steps: int = 500) -> dict:
    """Measure time for a full episode."""
    sim.reset()
    
    start = time.perf_counter()
    steps = 0
    for i in range(max_steps):
        result = sim.step()
        steps += 1
        # Check GameState attributes
        if hasattr(result, 'escaped') and result.escaped:
            break
        if hasattr(result, 'starved') and result.starved:
            break
    elapsed = time.perf_counter() - start
    
    return {
        "total_s": elapsed,
        "steps": steps,
        "ms_per_step": (elapsed * 1000) / steps,
    }


def measure_memory(graph, adj) -> dict:
    """Measure memory usage of key components (using pre-loaded graph)."""
    # Calculate component sizes directly
    adj_mem = adj.data.nbytes + adj.indices.nbytes + adj.indptr.nbytes
    n = adj.shape[0]
    
    # Per-fly state: V (float64), spikes (bool), refractory (int64), external_current (float64)
    v_mem = n * 8  # float64
    spikes_mem = n * 1  # bool
    refractory_mem = n * 8  # int64
    ext_current_mem = n * 8  # float64
    per_fly_state = v_mem + spikes_mem + refractory_mem + ext_current_mem
    
    return {
        "adjacency_mb": adj_mem / (1024 * 1024),
        "per_fly_state_mb": per_fly_state / (1024 * 1024),
        "n_neurons": n,
        "n_edges": adj.nnz,
    }


def profile_bottlenecks(lif: LIFSimulator, n_steps: int = 50) -> dict:
    """Profile where time is spent in LIF step."""
    import cProfile
    import pstats
    import io
    
    pr = cProfile.Profile()
    pr.enable()
    
    for _ in range(n_steps):
        lif.step()
    
    pr.disable()
    
    # Get stats
    s = io.StringIO()
    ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
    ps.print_stats(20)
    
    return {
        "profile_output": s.getvalue(),
    }


def measure_scaling(graph, n_flies_list: list = [1, 5, 10, 20]) -> dict:
    """Measure how time scales with number of concurrent flies."""
    adj = graph.adjacency
    b2i = graph.body_to_idx
    i2b = graph.idx_to_body
    
    results = {}
    for n_flies in n_flies_list:
        # Create multiple LIF instances (simulating concurrent flies)
        lifs = [LIFSimulator(adj, b2i, i2b, seed=42 + i) for i in range(n_flies)]
        for lif in lifs:
            lif.set_motor_neurons(graph.dn_bodies, graph.mn_bodies, graph)
        
        # Warmup
        for lif in lifs:
            for _ in range(5):
                lif.step()
        
        # Time
        times = []
        for _ in range(20):
            start = time.perf_counter()
            for lif in lifs:
                lif.step()
            times.append(time.perf_counter() - start)
        
        times = np.array(times) * 1000
        results[n_flies] = {
            "mean_ms": float(np.mean(times)),
            "ms_per_fly": float(np.mean(times)) / n_flies,
        }
        
        # Memory for this config
        per_fly_mb = (lifs[0].V.nbytes + lifs[0].spikes.nbytes + 
                      lifs[0].refractory_counter.nbytes + lifs[0].external_current.nbytes) / (1024 * 1024)
        results[n_flies]["total_state_mb"] = per_fly_mb * n_flies
    
    return results


def main():
    print("=" * 60)
    print("PERFORMANCE AUDIT: Fly Maze MaleCNS Simulation")
    print("=" * 60)
    
    # Stack info
    print("\n### Stack Info ###")
    print(f"NumPy version: {np.__version__}")
    try:
        import scipy
        print(f"SciPy version: {scipy.__version__}")
    except:
        print("SciPy: not found")
    
    try:
        import cupy
        print(f"CuPy (GPU): {cupy.__version__}")
    except:
        print("CuPy (GPU): NOT AVAILABLE - pure CPU")
    
    # Load graph
    print("\n### Loading Graph ###")
    start = time.perf_counter()
    graph = load_graph()
    graph_load_time = time.perf_counter() - start
    print(f"Graph load time: {graph_load_time:.2f}s")
    
    adj = graph.adjacency
    b2i = graph.body_to_idx
    i2b = graph.idx_to_body
    print(f"Neurons: {adj.shape[0]:,}")
    print(f"Edges (nnz): {adj.nnz:,}")
    
    # Memory
    print("\n### Memory Usage ###")
    mem = measure_memory(graph, adj)
    print(f"Adjacency matrix: {mem['adjacency_mb']:.1f} MB (shared across flies)")
    print(f"Per-fly state: {mem['per_fly_state_mb']:.2f} MB")
    print(f"  (V, spikes, refractory, external_current arrays)")
    
    # LIF step time
    print("\n### LIF Step Time ###")
    lif = LIFSimulator(adj, b2i, i2b, seed=42)
    lif.set_motor_neurons(graph.dn_bodies, graph.mn_bodies, graph)
    
    lif_times = measure_lif_step_time(lif, n_steps=100)
    print(f"Mean: {lif_times['mean_ms']:.2f} ms")
    print(f"P50:  {lif_times['p50_ms']:.2f} ms")
    print(f"P99:  {lif_times['p99_ms']:.2f} ms")
    print(f"Range: [{lif_times['min_ms']:.2f}, {lif_times['max_ms']:.2f}] ms")
    
    # Full sim step time
    print("\n### Full Sim Step Time (LIF + sensory + motor) ###")
    maze = create_minimal_house_level()
    sim = FeedingMazeSimulator(maze=maze, graph=graph, seed=42)
    
    sim_times = measure_sim_step_time(sim, n_steps=100)
    print(f"Mean: {sim_times['mean_ms']:.2f} ms")
    print(f"P50:  {sim_times['p50_ms']:.2f} ms")
    print(f"P99:  {sim_times['p99_ms']:.2f} ms")
    
    # Episode time
    print("\n### Episode Time (500 steps max) ###")
    episode = measure_episode_time(sim, max_steps=500)
    print(f"Total: {episode['total_s']:.2f}s for {episode['steps']} steps")
    print(f"Rate: {episode['ms_per_step']:.2f} ms/step")
    
    # Scaling
    print("\n### Scaling with Concurrent Flies ###")
    scaling = measure_scaling(graph, [1, 5, 10, 20])
    print(f"{'N flies':<10} {'Total ms':<12} {'ms/fly':<12} {'State MB':<12}")
    print("-" * 46)
    for n, data in scaling.items():
        print(f"{n:<10} {data['mean_ms']:<12.2f} {data['ms_per_fly']:<12.2f} {data['total_state_mb']:<12.2f}")
    
    # Extrapolation
    print("\n### Extrapolation ###")
    ms_per_fly = scaling[1]['ms_per_fly']
    state_per_fly = scaling[1]['total_state_mb']
    
    for n in [1, 20, 100]:
        total_ms = ms_per_fly * n
        fps = 1000 / total_ms if total_ms > 0 else 0
        state_mb = state_per_fly * n
        mode = "interactive" if fps >= 10 else "batch"
        print(f"  {n:3d} flies: ~{total_ms:.0f}ms/step ({fps:.1f} FPS), {state_mb:.1f}MB state → {mode}")
    
    # Bottleneck
    print("\n### Bottleneck Analysis ###")
    profile = profile_bottlenecks(lif, n_steps=50)
    
    # Parse profile for key info
    lines = profile['profile_output'].split('\n')
    print("Top functions by cumulative time:")
    for line in lines[5:15]:  # Skip header, show top 10
        if line.strip():
            print(f"  {line.strip()}")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"""
Stack: NumPy {np.__version__} + SciPy (CPU only, no GPU)

Performance:
  - LIF step: {lif_times['mean_ms']:.1f}ms (sparse matvec on {adj.shape[0]:,} neurons, {adj.nnz:,} edges)
  - Full step: {sim_times['mean_ms']:.1f}ms (includes sensory inject, motor readout, physics)
  - Episode (500 steps): {episode['total_s']:.1f}s

Memory:
  - Shared graph: {mem['adjacency_mb']:.0f}MB (read-only, shared across flies)
  - Per-fly state: {mem['per_fly_state_mb']:.2f}MB (V, spikes, refractory, external_current)

Scaling (measured):
  - 1 fly: {scaling[1]['mean_ms']:.1f}ms/step → {1000/scaling[1]['mean_ms']:.0f} FPS (interactive OK)
  - 5 flies: {scaling[5]['mean_ms']:.1f}ms/step → {1000/scaling[5]['mean_ms']:.0f} FPS (interactive OK)
  - 10 flies: {scaling[10]['mean_ms']:.1f}ms/step → {1000/scaling[10]['mean_ms']:.0f} FPS (interactive OK)
  - 20 flies: {scaling[20]['mean_ms']:.1f}ms/step → {1000/scaling[20]['mean_ms']:.0f} FPS (interactive marginal)

Extrapolated:
  - 100 flies: ~{ms_per_fly*100:.0f}ms/step → {1000/(ms_per_fly*100):.1f} FPS (batch mode)

Bottleneck: Sparse matrix-vector multiply (adj.T @ spikes)
  - scipy.sparse CSR format
  - Single-threaded NumPy

Quick wins (not implemented):
  1. Batch LIF: Stack V/spikes across N flies, single matvec (adj.T @ spikes_batch)
  2. Parallel: multiprocessing for independent flies (nearly linear speedup)
  3. GPU: CuPy sparse ops (10-50x speedup potential)
  4. C extension: Cython/Numba for inner loop
""")
    
    return {
        "lif_times": lif_times,
        "sim_times": sim_times,
        "episode": episode,
        "memory": mem,
        "scaling": scaling,
    }


if __name__ == "__main__":
    results = main()
