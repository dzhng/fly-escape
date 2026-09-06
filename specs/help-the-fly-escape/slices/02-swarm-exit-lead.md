# Slice 02: Swarm Run + Stars + Exit Lock + Shadow Corridor Lead

> **Kill Gate**: Swarm escapes Shadow Corridor (escape_rate > 10%, N=20)

---

## Contract

### What This Slice Delivers

1. **SwarmRunner** — Batch N≈20 flies with independent seeds
2. **Star scoring** — 25%/50%/75% thresholds
3. **Exit lock verified** — Right-wall + baffle + near-field magnet
4. **Shadow Corridor lead** — First playable level at ★ (20%+ escape)

### What This Slice Does NOT Deliver

- Full 4-level demo pack (Slice 03)
- ZapperPolicy (Slice 03)
- Turbo playback (Slice 03)

### Acceptance Criteria

- [ ] SwarmRunner runs N=20 flies in batch
- [ ] Star scoring correctly assigns ★/★★/★★★
- [ ] Exit is on right wall, baffle blocks hallway LOS
- [ ] Near-field magnet attracts when fly has LOS
- [ ] Shadow Corridor achieves 10%+ escape rate (N=20)
- [ ] Kill gate passes

---

## Seam

### SwarmRunner

```python
@dataclass
class FlyResult:
    seed: int
    outcome: str           # "ESCAPED" | "STARVED" | "ZAPPED" | "TIMEOUT"
    steps: int
    path: List[Tuple[float, float]]
    min_dist_to_exit: float
    takeoffs: int
    feeds: int

@dataclass
class SwarmResult:
    results: List[FlyResult]
    escaped: int
    starved: int
    zapped: int
    timeout: int
    escape_rate: float
    stars: str             # "★" | "★★" | "★★★" | "no stars"

class SwarmRunner:
    """Run N flies on same level with independent seeds."""
    
    def __init__(self, graph: VisualMotorGraph, level: Maze, n_flies: int = 20):
        self.graph = graph
        self.level = level
        self.n_flies = n_flies
    
    def run(self, base_seed: int = 42, max_steps: int = 2000) -> SwarmResult:
        results = []
        for i in range(self.n_flies):
            seed = base_seed + i
            sim = FeedingMazeSimulator(
                graph=self.graph, maze=self.level, seed=seed
            )
            result = self._run_single(sim, seed, max_steps)
            results.append(result)
        
        return self._aggregate(results)
    
    def _run_single(self, sim, seed, max_steps) -> FlyResult:
        path = [(sim.x, sim.y)]
        min_dist = float('inf')
        
        for step in range(max_steps):
            state = sim.step()
            path.append((sim.x, sim.y))
            
            exit_x, exit_y = self._get_exit_pos()
            dist = math.sqrt((sim.x - exit_x)**2 + (sim.y - exit_y)**2)
            min_dist = min(min_dist, dist)
            
            if state in (GameState.WON, GameState.STARVED, GameState.ZAPPED):
                return FlyResult(
                    seed=seed,
                    outcome=state.value.upper(),
                    steps=step + 1,
                    path=path,
                    min_dist_to_exit=min_dist,
                    takeoffs=sim.state.total_takeoffs,
                    feeds=sim.state.total_feeds,
                )
        
        return FlyResult(
            seed=seed, outcome="TIMEOUT", steps=max_steps,
            path=path, min_dist_to_exit=min_dist,
            takeoffs=sim.state.total_takeoffs, feeds=sim.state.total_feeds,
        )
    
    def _aggregate(self, results: List[FlyResult]) -> SwarmResult:
        escaped = sum(1 for r in results if r.outcome == "ESCAPED")
        starved = sum(1 for r in results if r.outcome == "STARVED")
        zapped = sum(1 for r in results if r.outcome == "ZAPPED")
        timeout = sum(1 for r in results if r.outcome == "TIMEOUT")
        
        escape_rate = escaped / len(results)
        
        if escape_rate >= 0.75:
            stars = "★★★"
        elif escape_rate >= 0.50:
            stars = "★★"
        elif escape_rate >= 0.25:
            stars = "★"
        else:
            stars = "no stars"
        
        return SwarmResult(
            results=results,
            escaped=escaped, starved=starved, zapped=zapped, timeout=timeout,
            escape_rate=escape_rate, stars=stars,
        )
```

### Exit Lock Layout

```
Exit Room (LAYOUT LOCK):

        ┌─────────────────────────────┐
        │        EXIT ROOM            │
        │                             │
        │   ▌ BAFFLE                  ├──☀ EXIT
HALLWAY─┤   (blocks LOS)              │   (right wall)
        │                             │   (orange glow)
        │                             │   (near-field magnet)
        └─────────────────────────────┘

Rules:
1. Exit door on RIGHT WALL (not opposite hallway)
2. Hallway enters from LEFT
3. BAFFLE wall blocks direct LOS from hallway to exit
4. Near-field magnet (small sigma ~40-50) only works with LOS
```

### Near-Field Magnet

```python
# Exit stimulus: fruit-like odor with SMALL sigma
exit_stimulus = Stimulus(
    type=StimulusType.EXIT,
    x=exit_x,         # Right wall position
    y=exit_y,         # Vertical center
    intensity=1.5,    # Strong when close
    sigma=40.0,       # SMALL radius — near-field only
)

# Behavior:
# - From hallway: fly CANNOT smell exit (too far, LOS blocked)
# - Enter room: fly MIGHT smell exit if close enough
# - Near exit: strong pull commits fly to escape
```

---

## Playable

### Shadow Corridor Level

```
Layout:
┌─────────────────────────────────────────────────────────┐
│  SPAWN      ▓▓SHADOW▓▓      CORRIDOR     ┌──────────────┤
│   ●═══════════════════════════════════════╡  EXIT ROOM  │
│   (fly)   (crumbs)                       │   ▌   ☀     │
│            (shadow zones)                └──────────────┤
└─────────────────────────────────────────────────────────┘

Stimuli:
- 2 shadow zones (scototaxis attraction)
- 8-10 crumbs (chemotaxis trail)
- 1 threat near spawn (takeoff trigger)
- 1 exit (right wall, near-field magnet)
- BAFFLE inside exit room

Expected behavior:
- Fly takes off from threat
- Follows crumb trail
- Hugs shadow zones (scototaxis)
- Enters exit room, navigates baffle
- Near-field magnet pulls to exit
- ESCAPE
```

### Star Thresholds

| Stars | Escape Rate | N=20 Escaped |
|-------|-------------|--------------|
| ★ | 25%+ | 5+ |
| ★★ | 50%+ | 10+ |
| ★★★ | 75%+ | 15+ |

Shadow Corridor target: **★ (20%+ escape)**

---

## Verification

### Kill Gate: Swarm Escape

```python
def kill_gate_02() -> bool:
    """Verify swarm escapes Shadow Corridor > 10%."""
    graph = load_visual_motor(Path('data'))
    level = create_level_1_shadow_corridor()
    
    runner = SwarmRunner(graph=graph, level=level, n_flies=20)
    result = runner.run(base_seed=42, max_steps=2000)
    
    print(f"Kill Gate 02: {result.escaped}/20 escaped ({result.escape_rate*100:.0f}%)")
    print(f"Stars: {result.stars}")
    
    assert result.escape_rate > 0.10, \
        f"KILL GATE FAILED: {result.escape_rate*100:.0f}% < 10%"
    
    return True
```

### Exit Lock Verification

```python
def verify_exit_lock():
    """Verify exit layout matches LAYOUT LOCK."""
    level = create_level_1_shadow_corridor()
    
    # Exit on right wall
    exit_stim = next(s for s in level.stimuli if s.type == StimulusType.EXIT)
    assert exit_stim.x > level.width * 0.8, "Exit must be on right wall"
    
    # Baffle exists
    baffle_walls = [w for w in level.walls if w.x > level.width * 0.7]
    assert len(baffle_walls) >= 1, "Baffle wall missing"
    
    # Near-field sigma
    assert exit_stim.sigma <= 50, f"Exit sigma {exit_stim.sigma} too large (max 50)"
    
    print("Exit lock verified: right wall, baffle, near-field")
```

### Scototaxis Verification

```python
def verify_scototaxis():
    """Verify fly prefers shadow zones."""
    # Run fly in arena with shadow on left, light on right
    # Measure time spent in each zone
    # Assert time_in_shadow > time_in_light
    pass
```

---

## Delegated

### From Slice 01

| Deliverable | Status |
|-------------|--------|
| SoftInterfaceRegistry | ✅ From Slice 01 |
| InjectBundle | ✅ From Slice 01 |
| 1-fly sandbox | ✅ From Slice 01 |
| Kill gate 01 | ✅ Passed |

### Level Creation

```python
def create_level_1_shadow_corridor() -> Maze:
    """Shadow Corridor — lead demo level."""
    # See run_level_playtest.py for implementation
    # Must include:
    # - Exit on right wall
    # - Baffle blocking hallway LOS
    # - Shadow zones for scototaxis
    # - Crumb trail
    # - Threat for takeoff
```

---

## Must-Stay-Green

### Tests That Must Pass

```python
def test_swarm_runner_aggregates():
    """SwarmRunner correctly counts outcomes."""
    # Mock results, verify aggregation

def test_star_thresholds():
    """Star thresholds: 25/50/75."""
    assert get_stars(0.24) == "no stars"
    assert get_stars(0.25) == "★"
    assert get_stars(0.50) == "★★"
    assert get_stars(0.75) == "★★★"

def test_exit_on_right_wall():
    """Exit must be on right wall of exit room."""
    verify_exit_lock()

def test_baffle_blocks_los():
    """Baffle must block LOS from hallway to exit."""
    # Raycast from hallway entry to exit
    # Assert blocked by baffle wall

def test_near_field_sigma():
    """Exit sigma must be ≤ 50 (near-field only)."""
    level = create_level_1_shadow_corridor()
    exit_stim = next(s for s in level.stimuli if s.type == StimulusType.EXIT)
    assert exit_stim.sigma <= 50
```

### Invariants

1. **Exit on right wall** — not opposite hallway
2. **Baffle blocks LOS** — raycast test
3. **Near-field sigma ≤ 50** — no long-range magnet
4. **Shadow Corridor escape > 10%** — kill gate

---

## Swarm Checklist

- [ ] Create `SwarmRunner` class
- [ ] Create `FlyResult` and `SwarmResult` dataclasses
- [ ] Implement star scoring (25/50/75)
- [ ] Verify exit lock layout
- [ ] Verify near-field magnet sigma
- [ ] Tune Shadow Corridor for 10%+ escape
- [ ] Run kill gate: swarm escapes > 10%
- [ ] Run exit lock verification
- [ ] Run must-stay-green tests
