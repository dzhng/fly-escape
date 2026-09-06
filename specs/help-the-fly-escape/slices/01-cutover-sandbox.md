# Slice 01: Cutover Shell + Live Sandbox Toolkit

> **Kill Gate**: 1-fly escapes Shadow Corridor (escape_rate > 0%)

---

## Contract

### What This Slice Delivers

1. **SoftInterfaceRegistry** — Audit layer for all geometric→neural boundaries
2. **InjectBundle** — Canonical types for current injection
3. **1-fly live sandbox** — Realtime interactive mode (~300 FPS)
4. **Hard cutover** — Clean transition from spike code to spec code

### What This Slice Does NOT Deliver

- Swarm batch (Slice 02)
- Turbo playback (Slice 03)
- Shop UI (out of scope)

### Acceptance Criteria

- [ ] SoftInterfaceRegistry lists all 5 soft interfaces
- [ ] InjectBundle used for all neural injection
- [ ] 1-fly runs at ~300 FPS (3.3ms/step)
- [ ] Shadow Corridor level loads and runs
- [ ] Kill gate passes: fly escapes at least once in 10 attempts

---

## Seam

### SoftInterfaceRegistry

```python
@dataclass
class SoftInterface:
    name: str
    input_type: str      # "geometric" | "state" | "sensor"
    output_type: str     # "current" | "spike" | "signal"
    neural_target: str   # Body ID list or type name
    purity: str          # "pure_graph" | "soft_stub" | "proxy"
    description: str

class SoftInterfaceRegistry:
    _interfaces: Dict[str, SoftInterface] = {}
    
    @classmethod
    def register(cls, interface: SoftInterface) -> None:
        cls._interfaces[interface.name] = interface
    
    @classmethod
    def audit(cls) -> List[SoftInterface]:
        return list(cls._interfaces.values())
    
    @classmethod
    def soft_stubs(cls) -> List[SoftInterface]:
        return [i for i in cls._interfaces.values() if i.purity != "pure_graph"]
    
    @classmethod
    def report(cls) -> str:
        lines = ["=== SOFT INTERFACE AUDIT ==="]
        for i in cls.audit():
            lines.append(f"{i.name}: {i.purity} → {i.neural_target}")
        return "\n".join(lines)
```

### Required Registrations

| Name | Input | Output | Target | Purity |
|------|-------|--------|--------|--------|
| `LandingLoom` | fruit pos + velocity | loom current | DNp07, DNp10 | soft_stub |
| `EscapeLoom` | threat pos + velocity | loom current | LC4 | pure_graph (from LC4) |
| `Scototaxis` | shadow/light zones | bilateral AOTU current | AOTU L/R | soft_stub |
| `ExitMagnet` | exit pos + LOS | fruit-proxy odor | Excitatory LH | proxy |
| `TakeoffGate` | hunger + threat | takeoff current | DNb01, DNb02 | soft_stub |

### InjectBundle

```python
@dataclass
class InjectBundle:
    """Canonical current injection for one timestep."""
    
    # Olfactory (chemotaxis)
    attractive_lh_left: float = 0.0
    attractive_lh_right: float = 0.0
    aversive_lh_left: float = 0.0
    aversive_lh_right: float = 0.0
    
    # Visual (scototaxis)
    aotu_left: float = 0.0
    aotu_right: float = 0.0
    
    # Escape (loom)
    lc4_inject: float = 0.0  # Graph handles LC4→DNp04
    
    # Landing
    landing_dn_left: float = 0.0
    landing_dn_right: float = 0.0
    
    # Takeoff
    takeoff_dn_left: float = 0.0
    takeoff_dn_right: float = 0.0
    
    # Feeding
    grn_sugar: float = 0.0
    
    def to_current_dict(self, system: 'LandingFeedingSystem') -> Dict[int, float]:
        """Convert bundle to body_id → current mapping."""
        currents = {}
        # ... map each field to body IDs via system indices
        return currents
```

---

## Playable

### 1-Fly Live Sandbox

**Mode**: `SANDBOX`
**Flies**: 1
**Budget**: Unlimited
**Simulation**: Realtime (~300 FPS)

```python
class SandboxMode:
    """Live 1-fly sandbox for tutorial."""
    
    def __init__(self, graph: VisualMotorGraph, level: Maze):
        self.sim = FeedingMazeSimulator(graph=graph, maze=level, seed=42)
        self.running = True
    
    def step(self) -> GameState:
        """One simulation step — call at ~300 Hz."""
        return self.sim.step()
    
    def place_stimulus(self, stim: Stimulus) -> None:
        """Dynamically add stimulus during play."""
        self.sim.maze.stimuli.append(stim)
        self.sim._rebuild_sources()  # Refresh source lists
    
    def remove_stimulus(self, stim: Stimulus) -> None:
        """Remove stimulus during play."""
        self.sim.maze.stimuli.remove(stim)
        self.sim._rebuild_sources()
    
    def reset(self, seed: Optional[int] = None) -> None:
        """Reset fly to spawn."""
        self.sim.reset(new_seed=seed)
```

### Live Interaction

User can:
- Drop fruit → see chemotaxis
- Drop threat → see escape + takeoff
- Drop shadow → see scototaxis
- Reset fly → try again

Performance budget: 3.3ms/step → 300 FPS → smooth realtime.

---

## Verification

### Kill Gate: 1-Fly Escape

```python
def kill_gate_01() -> bool:
    """Verify 1-fly can escape Shadow Corridor."""
    graph = load_visual_motor(Path('data'))
    level = create_level_1_shadow_corridor()
    
    escapes = 0
    for seed in range(10):
        sim = FeedingMazeSimulator(graph=graph, maze=level, seed=seed)
        for _ in range(2000):
            result = sim.step()
            if result == GameState.WON:
                escapes += 1
                break
    
    escape_rate = escapes / 10
    print(f"Kill Gate 01: {escapes}/10 escaped ({escape_rate*100:.0f}%)")
    
    assert escape_rate > 0, "KILL GATE FAILED: No flies escaped!"
    return True
```

### SoftInterfaceRegistry Audit

```python
def verify_registry():
    """Verify all soft interfaces are registered."""
    audit = SoftInterfaceRegistry.audit()
    
    required = {'LandingLoom', 'EscapeLoom', 'Scototaxis', 'ExitMagnet', 'TakeoffGate'}
    registered = {i.name for i in audit}
    
    missing = required - registered
    assert not missing, f"Missing registrations: {missing}"
    
    print(SoftInterfaceRegistry.report())
```

---

## Delegated

### From Spike Code (KEEP)

These modules are proven and should be wrapped, not rewritten:

| Module | Keep As-Is | Wrap With |
|--------|-----------|-----------|
| `VisualMotorGraph` | ✅ | — |
| `LIFSimulator` | ✅ | — |
| `FeedingMazeSimulator` | ✅ | SoftInterfaceRegistry |
| `LandingFeedingSystem` | ✅ | InjectBundle |
| `FlightDynamics` | ✅ | — |

### Refactor Touch Points

| File | Change | Reason |
|------|--------|--------|
| `feeding_maze_sim.py` | Add SoftInterfaceRegistry calls | Audit soft stubs |
| `landing_feeding.py` | Use InjectBundle | Canonical injection |
| `maze.py` | Add `_rebuild_sources()` | Live stimulus changes |

---

## Must-Stay-Green

### Tests That Must Pass

```python
def test_lif_step_performance():
    """LIF step must be < 5ms."""
    # ... existing perf test

def test_chemotaxis_pure_graph():
    """Chemotaxis must not use chemotaxis_gain."""
    # Grep for chemotaxis_gain in codebase
    # Assert not found

def test_escape_uses_lc4():
    """Escape loom must inject to LC4, not directly to DN."""
    # Verify LC4 body IDs in injection

def test_landing_uses_dnp07():
    """Landing must inject to DNp07/10."""
    # Verify landing DN body IDs

def test_soft_interfaces_registered():
    """All soft interfaces must be in registry."""
    verify_registry()
```

### Invariants

1. **No chemotaxis_gain** — grep codebase, must be 0 matches
2. **No dist<ε land/eat** — grep for distance threshold cheats
3. **LIF step < 5ms** — performance regression test
4. **70k neurons** — subgraph size unchanged

---

## Cutover Checklist

- [ ] Create `SoftInterfaceRegistry` class
- [ ] Create `InjectBundle` dataclass
- [ ] Register all 5 soft interfaces
- [ ] Wrap `LandingFeedingSystem` injection with `InjectBundle`
- [ ] Add `_rebuild_sources()` to `FeedingMazeSimulator`
- [ ] Create `SandboxMode` class
- [ ] Run kill gate: 1-fly escapes
- [ ] Run soft interface audit
- [ ] Run must-stay-green tests
