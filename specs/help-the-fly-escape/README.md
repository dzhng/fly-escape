# Help the Fly Escape — Implementation Spec

> **STATUS**: SPEC COMPLETE — DO NOT START IMPLEMENT-SPEC UNTIL DAVID SAYS GO

---

## Next Agent Prompt

```
You are implementing "Help the Fly Escape" — a tech-demo game where a real fly brain
(MaleCNS LIF 70k neurons) navigates a house to reach an exit.

STEP 0 (if no chat context):
- Read HANDOFF.md first — single entry for scoping
- Read DECISIONS.md — key chat decisions table
- Read spikes/README.md — spike documentation index

The spec is in `specs/help-the-fly-escape/`. Read slices in order: 01 → 02 → 03.
Each slice has Contract, Seam, Playable, Verification, Delegated, Must-stay-green.

KEY CONSTRAINTS:
- Pure graph motor (no chemotaxis_gain, no dist<ε cheats)
- SoftInterfaceRegistry for all geometric→neural boundaries
- Kill gates verify escape before proceeding
- 1-fly live sandbox must work before swarm

The game already has:
- Working chemotaxis (bilateral LH), scototaxis (AOTU), escape loom (LC4→DNp04)
- Walk-vs-fly with takeoff (DNb01/02), landing (DNp07/10), feeding
- 4 demo levels, zapper hazard, house layout with occluded exit

You are CUTTING OVER from spike code, not building from scratch.
Preserve proven neural pathways; wrap soft stubs in SoftInterfaceRegistry.
```

---

## Global TODO

| Priority | Item | Slice | Status |
|----------|------|-------|--------|
| P0 | SoftInterfaceRegistry abstraction | 01 | TODO |
| P0 | InjectBundle canonical types | 01 | TODO |
| P0 | 1-fly live sandbox working | 01 | TODO |
| P0 | Hard cutover from spike code | 01 | TODO |
| P1 | Swarm (N=20) batch + replay | 02 | TODO |
| P1 | Right-wall exit + baffle verified | 02 | TODO |
| P1 | Shadow Corridor lead level | 02 | TODO |
| P1 | Kill gate: escape rate > 0% | 02 | TODO |
| P2 | 4-level demo pack | 03 | TODO |
| P2 | ZapperPolicy (0 or 1) | 03 | TODO |
| P2 | Turbo playback | 03 | TODO |
| P2 | Ship artifact | 03 | TODO |

---

## Goal / Non-Goals

### Goals

1. **Cool tech demo** of real fly brain navigating a house
2. **Playable** — not perfectly balanced, but winnable with strategy
3. **Quirky behaviors** emerge from neural dynamics (desirable!)
4. **Pure graph motor** — behavior from MaleCNS, not external cheats
5. **1-fly live** for tutorial, **swarm batch** for scored levels

### Non-Goals

1. ❌ Perfectly balanced competitive game
2. ❌ Full shop UI with drag-drop
3. ❌ Dm8/R7-R8 full phototaxis subgraph
4. ❌ 100-fly optimization
5. ❌ Campaign progression
6. ❌ Procedural level generation
7. ❌ Mobile/web deployment

---

## Ownership Invariants

These boundaries MUST NOT be crossed without explicit approval:

| Boundary | Owner | Invariant |
|----------|-------|-----------|
| Neural pathways | MaleCNS LIF | All motor output from graph dynamics |
| Soft interfaces | SoftInterfaceRegistry | All geometric→neural boundaries registered |
| Purity bar | BANNED list | No chemotaxis_gain, no dist<ε, no teleport |
| Graph data | visual_motor subgraph | 70k neurons, no expansion without OOM check |
| Game state | FeedingMazeSimulator | Single source of truth for fly position/state |

---

## Soft-Interface Register

All "soft stubs" (geometric computation injected to neural pathway) MUST be registered:

| Interface | Input | Output | Neural Target | Purity |
|-----------|-------|--------|---------------|--------|
| `LandingLoom` | fruit position, fly velocity | loom signal | DNp07, DNp10 | ⚠️ Soft |
| `EscapeLoom` | threat position, fly velocity | loom signal | LC4 (then graph) | ✅ Graph from LC4 |
| `Scototaxis` | shadow/light zones, fly position | bilateral intensity | AOTU L/R | ⚠️ Soft cue, graph motor |
| `ExitMagnet` | exit position, fly position, LOS | fruit-like odor | Excitatory LH | ⚠️ Proxy (no CO₂ ORNs) |
| `TakeoffGate` | hunger level, threat loom | injection current | DNb01, DNb02 | ⚠️ Soft threshold |

### Registry Contract

```python
class SoftInterfaceRegistry:
    """Register and audit all geometric→neural boundaries."""
    
    def register(self, name: str, input_type: str, output_type: str, 
                 neural_target: str, purity: str) -> None: ...
    
    def audit(self) -> List[SoftInterface]: ...
    
    def is_pure(self, name: str) -> bool: ...
```

---

## Kill Gates

Each slice has a kill gate — a verification that MUST pass before proceeding:

| Slice | Kill Gate | Metric | Threshold |
|-------|-----------|--------|-----------|
| 01 | 1-fly escapes | escape_rate(N=1, Shadow Corridor) | > 0% |
| 02 | Swarm escapes | escape_rate(N=20, Shadow Corridor) | > 10% |
| 03 | Demo pack viable | min(escape_rate) across 4 levels | ≥ 0% AND max ≤ 100% |

If a kill gate fails, STOP and debug before proceeding.

---

## Draft Synthesis

### Fewest Canonical Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `VisualMotorGraph` | 70k neuron subgraph + adjacency | ✅ Exists |
| `LIFSimulator` | Leaky integrate-and-fire dynamics | ✅ Exists |
| `FeedingMazeSimulator` | Game loop, state, collision | ✅ Exists |
| `FlightDynamics` | Walk/fly physics + mode switching | ✅ Exists |
| `LandingFeedingSystem` | Behavior states, feeding, takeoff | ✅ Exists |
| `SoftInterfaceRegistry` | Audit soft stubs | 🆕 Slice 01 |
| `InjectBundle` | Canonical current injection | 🆕 Slice 01 |
| `SwarmRunner` | Batch N flies, aggregate metrics | 🆕 Slice 02 |
| `TurboPlayback` | Fast-forward sim, replay paths | 🆕 Slice 03 |

### Risk-First → Verify Order

1. **Risk**: Soft stubs untracked → ship with hidden cheats
   - **Verify**: SoftInterfaceRegistry audit before Slice 02

2. **Risk**: 1-fly doesn't escape → swarm will fail
   - **Verify**: Kill gate 01 (1-fly escape > 0%)

3. **Risk**: Exit baffle blocks all flies → 0% escape
   - **Verify**: Kill gate 02 (swarm > 10%) with Shadow Corridor

4. **Risk**: Zappers are RNG death → unfun
   - **Verify**: ZapperPolicy(0-1) in Slice 03, escape_rate delta measured

### 19-Seam REJECTED

We considered a 19-seam architecture with separate modules for each neural pathway.
**REJECTED** because:
- Spike code already works with colocated injection logic
- Refactoring adds risk without adding capability
- SoftInterfaceRegistry provides audit without restructuring

---

## Firewalls

These are OUT OF SCOPE — do not build:

| Item | Reason | Deferred To |
|------|--------|-------------|
| Shop UI | Not blocking tech demo | Post-ship |
| Dm8 phototaxis | Not in subgraph, AOTU sufficient | Never (OOM) |
| 100-fly batch | 20 sufficient for demo | Post-ship |
| Campaign progression | Levels are demo, not campaign | Post-ship |
| Wind advection | Stubbed, not critical for demo | P2 |
| CO₂/hygro exit cue | Fruit proxy works, PNs available if needed | P2 |
| Procedural levels | Hand-crafted for demo | Post-ship |
| Mobile/web | Desktop demo only | Post-ship |

---

## Deferred Fog

Things we know we don't know:

| Fog | Impact | Mitigation |
|-----|--------|------------|
| Budget economy depth | Unknown if meaningful choices exist | P0.2 showed noise; defer until N=10+ tested |
| Optimal trail configs | Unknown best placement | Playtest pass found 20% escape; iterate |
| Zapper fairness | 3 zappers = RNG death | ZapperPolicy(0-1) in Slice 03 |
| Scototaxis vs chemotaxis dominance | Unknown which wins in conflict | Playtest showed shadow preference; document |
| Exit PN injection | Untested V/VL/VP injection for exit | Fruit proxy works; defer unless needed |

---

## Slice Summary

| Slice | Name | Deliverable |
|-------|------|-------------|
| [01](slices/01-cutover-sandbox.md) | Cutover Shell + Live Sandbox | SoftInterfaceRegistry, InjectBundle, 1-fly live, hard cutover |
| [02](slices/02-swarm-exit-lead.md) | Swarm Run + Stars + Exit Lock | N≈20 batch, right-wall exit + baffle, Shadow Corridor lead |
| [03](slices/03-demo-pack-zapper-turbo.md) | Demo Pack + Zapper + Turbo | 4 levels, ZapperPolicy, turbo playback, ship |

---

## Spikes (In-Spec)

All spike documentation lives in [`spikes/`](spikes/):

| Document | Purpose |
|----------|---------|
| [spikes/README.md](spikes/README.md) | **Index** — Timeline, doc index, code locations |
| [spikes/GAME_DESIGN.md](spikes/GAME_DESIGN.md) | Product vision, locks, art direction |
| [spikes/MECHANICS_DERISK.md](spikes/MECHANICS_DERISK.md) | P0 spike results, derisk assessment |
| [spikes/SPIKE_LEARNINGS.md](spikes/SPIKE_LEARNINGS.md) | Science diary — neural pathway discoveries |
| [spikes/BALANCE.md](spikes/BALANCE.md) | Tweakable parameters, designer levers |
| [spikes/choices.md](spikes/choices.md) | Technical decision log |

**Origin `src/` is the spike code home** — all working code lives at repo root.

### Key Spike Findings

| Finding | Source | Impact |
|---------|--------|--------|
| Bilateral LH injection = real chemotaxis | SPIKE_LEARNINGS §1 | Core mechanic works |
| LHAD1g1 is GABAergic (aversion) | SPIKE_LEARNINGS §2 | Vinegar pathway |
| LC4→DNp04 = Giant Fiber escape | SPIKE_LEARNINGS §6 | Escape loom pure graph |
| AOTU→DNa02/03 = scototaxis | SPIKE_LEARNINGS §6 | Shadow preference |
| 3 zappers = RNG death | MECHANICS_DERISK P0.3 | ZapperPolicy(0-1) |
| 20% escape on Shadow Corridor | Level playtest | Lead demo level |

---

## Visualizations

- [Roadmap](visualizations/roadmap.html)

---

## ⚠️ DO NOT START IMPLEMENT-SPEC

This spec is complete. Implementation awaits David's explicit "go" signal.

Until then:
- Review spec for gaps
- Ask clarifying questions
- Do NOT write implementation code
