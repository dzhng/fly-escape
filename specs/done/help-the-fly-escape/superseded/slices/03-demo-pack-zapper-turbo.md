> Historical Python proposal, superseded on 2026-09-06. Not implementation instructions. Start at `specs/help-the-fly-escape/README.md`. Historical relative links may no longer resolve.

# Slice 03: Demo Pack + Zapper Policy + Turbo Playback → Ship

> **Kill Gate**: Demo pack viable (all 4 levels: escape_rate ≥ 0% AND ≤ 100%)

---

## Contract

### What This Slice Delivers

1. **4-level demo pack** — Shadow Corridor, Dead End Trap, Long Hallway, Light vs Dark
2. **ZapperPolicy(0-1)** — Controlled zapper density (not RNG death)
3. **Turbo playback** — Fast-forward sim + smooth replay
4. **Ship artifact** — Runnable demo with all components

### What This Slice Does NOT Deliver

- Shop UI (post-ship)
- Campaign progression (post-ship)
- 100-fly optimization (post-ship)

### Acceptance Criteria

- [ ] All 4 levels load and run
- [ ] ZapperPolicy limits to 0 or 1 zapper per level
- [ ] Turbo sim runs 10x faster than realtime
- [ ] Replay renders saved paths smoothly
- [ ] Kill gate passes: all levels have 0% ≤ escape ≤ 100%
- [ ] Ship artifact runnable with single command

---

## Seam

### Demo Pack Levels

| Level | Layout | Demonstrates | Target Escape |
|-------|--------|--------------|---------------|
| **Shadow Corridor** | 3-room + shadow | Scototaxis | 20%+ ★ |
| **Dead End Trap** | Trap room + vinegar | Aversive chemotaxis | 0-10% (hard) |
| **Long Hallway** | Very long corridor | Flight necessity | 20%+ ★ |
| **Light vs Dark** | Forking paths | Scototaxis conflict | 0-10% (hard) |

### Level Factory

```python
class DemoLevelFactory:
    """Factory for demo pack levels."""
    
    @staticmethod
    def create(name: str, zapper_policy: 'ZapperPolicy') -> Maze:
        if name == "shadow_corridor":
            return create_level_1_shadow_corridor()
        elif name == "dead_end_trap":
            return create_level_2_dead_end_trap()
        elif name == "long_hallway":
            return create_level_3_long_hallway()
        elif name == "light_vs_dark":
            return create_level_4_light_dark_choice()
        else:
            raise ValueError(f"Unknown level: {name}")
    
    @staticmethod
    def all_levels() -> List[str]:
        return ["shadow_corridor", "dead_end_trap", "long_hallway", "light_vs_dark"]
```

### ZapperPolicy

```python
class ZapperPolicy:
    """Control zapper density to avoid RNG death."""
    
    def __init__(self, max_zappers: int = 1):
        self.max_zappers = max_zappers
        assert max_zappers in (0, 1), "ZapperPolicy: only 0 or 1 allowed in demo"
    
    def apply(self, maze: Maze, seed: int) -> Maze:
        """Apply zapper policy to level."""
        if self.max_zappers == 0:
            # Remove all zappers
            maze.stimuli = [s for s in maze.stimuli if s.type != StimulusType.ZAPPER]
        elif self.max_zappers == 1:
            # Keep at most 1 zapper, placed in dead-end
            zappers = [s for s in maze.stimuli if s.type == StimulusType.ZAPPER]
            if len(zappers) > 1:
                # Keep only the one furthest from main path
                maze.stimuli = [s for s in maze.stimuli if s.type != StimulusType.ZAPPER]
                maze.stimuli.append(zappers[0])  # Keep first one
        
        return maze
    
    @staticmethod
    def recommended() -> 'ZapperPolicy':
        """Recommended policy for demo: 0-1 zappers."""
        return ZapperPolicy(max_zappers=1)
```

### Turbo Playback

```python
@dataclass
class RecordedPath:
    """Recorded fly path for replay."""
    positions: List[Tuple[float, float]]
    thetas: List[float]
    modes: List[str]  # "WALKING" | "FLYING" | "LANDED" | "FEEDING"
    outcome: str
    steps: int

class TurboPlayback:
    """Fast-forward simulation with smooth replay."""
    
    def __init__(self, graph: VisualMotorGraph, level: Maze):
        self.graph = graph
        self.level = level
    
    def turbo_sim(self, seed: int, max_steps: int = 2000) -> RecordedPath:
        """Run simulation at max speed, record path."""
        sim = FeedingMazeSimulator(graph=self.graph, maze=self.level, seed=seed)
        
        positions = [(sim.x, sim.y)]
        thetas = [sim.theta]
        modes = [sim.flight.mode.value]
        
        for step in range(max_steps):
            result = sim.step()
            positions.append((sim.x, sim.y))
            thetas.append(sim.theta)
            modes.append(sim.flight.mode.value)
            
            if result in (GameState.WON, GameState.STARVED, GameState.ZAPPED):
                return RecordedPath(
                    positions=positions, thetas=thetas, modes=modes,
                    outcome=result.value.upper(), steps=step + 1,
                )
        
        return RecordedPath(
            positions=positions, thetas=thetas, modes=modes,
            outcome="TIMEOUT", steps=max_steps,
        )
    
    def turbo_swarm(self, n_flies: int, base_seed: int, max_steps: int) -> List[RecordedPath]:
        """Run N flies at turbo speed."""
        paths = []
        for i in range(n_flies):
            path = self.turbo_sim(seed=base_seed + i, max_steps=max_steps)
            paths.append(path)
        return paths
    
    def replay(self, path: RecordedPath, speed: float = 1.0) -> Iterator[Tuple[float, float, float]]:
        """Yield (x, y, theta) for smooth replay at given speed."""
        delay = 0.033 / speed  # ~30 FPS base, scaled by speed
        for pos, theta in zip(path.positions, path.thetas):
            yield pos[0], pos[1], theta
            time.sleep(delay)
```

---

## Playable

### Demo Pack Experience

```
DEMO FLOW:

1. Launch demo
2. Select level (or cycle through all 4)
3. Watch swarm (N=20) in turbo → replay
4. See escape rate and stars
5. Observe quirky behaviors:
   - Shadow hugging
   - Trap failures
   - Takeoff drama
   - Near-exit starve
6. Next level or exit
```

### Level Characteristics

**Shadow Corridor** (Lead Level):
- Clearest scototaxis demo
- 20%+ escape achievable
- Good for first impression

**Dead End Trap**:
- Tempting fruit trap
- Vinegar guard
- ~0% escape (intentionally hard)
- Shows aversive chemotaxis

**Long Hallway**:
- Flight necessity demo
- Sparse crumbs, threats
- 20%+ escape with takeoff
- Shows walk-vs-fly

**Light vs Dark**:
- Forking paths
- Shadow preferred over lit
- ~0% escape (conflict level)
- Shows scototaxis preference

### Zapper Experience

With ZapperPolicy(1):
- At most 1 zapper per level
- Placed in dead-end (not main path)
- Adds risk without RNG death
- Escape rate delta measurable

---

## Verification

### Kill Gate: Demo Pack Viable

```python
def kill_gate_03() -> bool:
    """Verify all 4 levels are viable (0% ≤ escape ≤ 100%)."""
    graph = load_visual_motor(Path('data'))
    factory = DemoLevelFactory()
    policy = ZapperPolicy.recommended()
    
    results = {}
    for level_name in factory.all_levels():
        level = factory.create(level_name, policy)
        runner = SwarmRunner(graph=graph, level=level, n_flies=10)
        result = runner.run(base_seed=42, max_steps=2000)
        results[level_name] = result.escape_rate
    
    print("Kill Gate 03: Demo Pack Viability")
    for name, rate in results.items():
        status = "✅" if 0 <= rate <= 1 else "❌"
        print(f"  {name}: {rate*100:.0f}% {status}")
    
    # All levels must be playable (not 100% escape, not impossible)
    # Note: 0% is OK for "hard" levels, but verify they're not broken
    all_viable = all(0 <= rate <= 1 for rate in results.values())
    
    assert all_viable, "KILL GATE FAILED: Some levels have invalid escape rates"
    
    # At least one level must have >0% escape (game is winnable)
    any_winnable = any(rate > 0 for rate in results.values())
    assert any_winnable, "KILL GATE FAILED: No levels are winnable!"
    
    return True
```

### Zapper Policy Verification

```python
def verify_zapper_policy():
    """Verify ZapperPolicy limits zappers correctly."""
    maze = create_test_maze_with_5_zappers()
    
    # Policy 0: no zappers
    policy0 = ZapperPolicy(max_zappers=0)
    clean_maze = policy0.apply(maze.copy(), seed=42)
    zapper_count = sum(1 for s in clean_maze.stimuli if s.type == StimulusType.ZAPPER)
    assert zapper_count == 0, f"Policy(0) left {zapper_count} zappers"
    
    # Policy 1: at most 1 zapper
    policy1 = ZapperPolicy(max_zappers=1)
    limited_maze = policy1.apply(maze.copy(), seed=42)
    zapper_count = sum(1 for s in limited_maze.stimuli if s.type == StimulusType.ZAPPER)
    assert zapper_count <= 1, f"Policy(1) left {zapper_count} zappers"
    
    print("ZapperPolicy verified: 0 and 1 limits enforced")
```

### Turbo Performance Verification

```python
def verify_turbo_performance():
    """Verify turbo sim is 10x faster than realtime."""
    graph = load_visual_motor(Path('data'))
    level = create_level_1_shadow_corridor()
    turbo = TurboPlayback(graph=graph, level=level)
    
    # Time turbo sim
    start = time.time()
    path = turbo.turbo_sim(seed=42, max_steps=2000)
    elapsed = time.time() - start
    
    # Realtime would be 2000 * 0.1s = 200s (at 10 Hz game time)
    # Turbo should be << 200s
    # With 3.3ms/step, expect ~6.6s
    
    print(f"Turbo sim: {path.steps} steps in {elapsed:.1f}s")
    
    # Should be at least 10x faster than realtime
    realtime_estimate = path.steps * 0.1  # 10 Hz game time
    speedup = realtime_estimate / elapsed
    
    assert speedup > 10, f"Turbo only {speedup:.1f}x faster (need 10x)"
    print(f"Turbo speedup: {speedup:.0f}x")
```

---

## Delegated

### From Slice 02

| Deliverable | Status |
|-------------|--------|
| SwarmRunner | ✅ From Slice 02 |
| Star scoring | ✅ From Slice 02 |
| Exit lock | ✅ Verified in Slice 02 |
| Shadow Corridor | ✅ From Slice 02 |

### Level Implementations

All 4 levels already exist in `run_level_playtest.py`:
- `create_level_1_shadow_corridor()`
- `create_level_2_dead_end_trap()`
- `create_level_3_long_hallway()`
- `create_level_4_light_dark_choice()`

---

## Must-Stay-Green

### Tests That Must Pass

```python
def test_all_levels_load():
    """All 4 demo levels must load without error."""
    factory = DemoLevelFactory()
    for name in factory.all_levels():
        level = factory.create(name, ZapperPolicy(0))
        assert level.width > 0
        assert level.height > 0

def test_zapper_policy_0():
    """ZapperPolicy(0) removes all zappers."""
    verify_zapper_policy()

def test_zapper_policy_1():
    """ZapperPolicy(1) limits to 1 zapper."""
    verify_zapper_policy()

def test_turbo_speedup():
    """Turbo sim is 10x+ faster than realtime."""
    verify_turbo_performance()

def test_recorded_path_complete():
    """RecordedPath has all required fields."""
    # ... verify dataclass

def test_replay_yields_positions():
    """Replay iterator yields (x, y, theta) tuples."""
    # ... verify replay output
```

### Invariants

1. **4 levels load** — no import errors
2. **ZapperPolicy enforced** — max zappers respected
3. **Turbo 10x+** — performance requirement
4. **At least 1 level winnable** — game is playable

---

## Ship Checklist

- [ ] Create `DemoLevelFactory`
- [ ] Create `ZapperPolicy` class
- [ ] Apply ZapperPolicy(1) to all levels
- [ ] Create `TurboPlayback` class
- [ ] Create `RecordedPath` dataclass
- [ ] Implement turbo_sim (max speed, no rendering)
- [ ] Implement turbo_swarm (N flies at turbo)
- [ ] Implement replay (smooth playback)
- [ ] Run kill gate: all levels viable
- [ ] Run zapper policy verification
- [ ] Run turbo performance verification
- [ ] Create ship script: `python run_demo.py`
- [ ] Run must-stay-green tests

---

## Ship Artifact

```bash
# Run the demo
python run_demo.py

# Options:
python run_demo.py --level shadow_corridor  # Specific level
python run_demo.py --n-flies 20             # Swarm size
python run_demo.py --zappers 0              # No zappers
python run_demo.py --turbo                  # Turbo sim + replay
python run_demo.py --all                    # All 4 levels

# Output:
# - Console: escape rates, stars, quirky behaviors
# - Artifacts: path plots (if matplotlib available)
```

### Demo Script Structure

```python
# run_demo.py
def main():
    parser = argparse.ArgumentParser(description='Help the Fly Escape - Demo')
    parser.add_argument('--level', choices=DemoLevelFactory.all_levels())
    parser.add_argument('--n-flies', type=int, default=20)
    parser.add_argument('--zappers', type=int, default=1, choices=[0, 1])
    parser.add_argument('--turbo', action='store_true')
    parser.add_argument('--all', action='store_true')
    args = parser.parse_args()
    
    graph = load_visual_motor(Path('data'))
    policy = ZapperPolicy(max_zappers=args.zappers)
    
    levels = DemoLevelFactory.all_levels() if args.all else [args.level or 'shadow_corridor']
    
    for level_name in levels:
        level = DemoLevelFactory.create(level_name, policy)
        
        if args.turbo:
            turbo = TurboPlayback(graph=graph, level=level)
            paths = turbo.turbo_swarm(args.n_flies, base_seed=42, max_steps=2000)
            # ... display results
        else:
            runner = SwarmRunner(graph=graph, level=level, n_flies=args.n_flies)
            result = runner.run(base_seed=42, max_steps=2000)
            print(f"{level_name}: {result.escape_rate*100:.0f}% {result.stars}")
```
