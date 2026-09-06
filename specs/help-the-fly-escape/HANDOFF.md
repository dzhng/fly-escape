# HANDOFF — Help the Fly Escape

> **Single entry point for scoping.** Read this first if you have no chat context.

---

## The Pitch

**Help the Fly Escape** is a tech-demo game where a real fly brain (MaleCNS, 70k neurons, LIF simulation) navigates a house to reach an exit.

The player places sensory cues (fruit, shadow, threat) to guide the fly. The fly's behavior emerges from actual neural dynamics — chemotaxis, scototaxis, escape responses — not hand-coded AI.

**#1 goal = cool simulation / tech demo of the real fly brain.** Game only needs to be playable and somewhat fun. Quirks are OK (even desirable). NOT chasing perfect balance.

---

## Priority

| Priority | Item | Status |
|----------|------|--------|
| **P0** | Tech demo showing real neural behavior | ✅ Spike complete |
| **P1** | Playable with swarm scoring | 📋 Spec ready |
| **P2** | 4-level demo pack | 📋 Spec ready |
| **P3** | Shop UI, campaign | ❌ Out of scope |

**Current phase**: Spike complete, spec complete, awaiting implement-go.

---

## Exists vs Build

### ✅ EXISTS (Spike Code at Repo Root)

| Component | Location | Status |
|-----------|----------|--------|
| MaleCNS graph loader | `src/graph_loader.py` | Working |
| LIF simulator | `src/lif_sim.py` | Working (3.3ms/step) |
| Game loop + state | `src/feeding_maze_sim.py` | Working |
| Walk/fly dynamics | `src/flight.py` | Working |
| Behavior states | `src/landing_feeding.py` | Working |
| Maze structures | `src/maze.py` | Working |
| Demo levels | `src/house_level.py` | Working |
| Level playtest | `run_level_playtest.py` | Working |

### 🆕 BUILD (Implementation Slices)

| Component | Slice | Purpose |
|-----------|-------|---------|
| SoftInterfaceRegistry | 01 | Audit soft stubs |
| InjectBundle | 01 | Canonical injection |
| SwarmRunner | 02 | Batch N flies |
| ZapperPolicy | 03 | Control zapper density |
| TurboPlayback | 03 | Fast-forward + replay |
| DemoLevelFactory | 03 | Level creation |

### ❌ DO NOT BUILD

- Shop UI
- Dm8/R7-R8 phototaxis megagraph
- 100-fly optimization
- Campaign progression
- Procedural levels
- Mobile/web

---

## Game Scope

### Core Loop

```
1. View house (3-4 rooms)
2. Place toolkit items (fruit, shadow, threat, etc.)
3. Watch fly navigate (MaleCNS neural AI)
4. Win: Fly escapes before starving
5. Retry with different strategy
```

### Swarm Scoring

- **N ≈ 20 flies** with independent seeds
- **Stars**: 25% = ★, 50% = ★★, 75% = ★★★
- Neural noise creates variance — good placement works for most flies

### Purity Bar (NON-NEGOTIABLE)

All behavior from MaleCNS graph dynamics:

| Behavior | Implementation | Purity |
|----------|----------------|--------|
| Chemotaxis | Bilateral LH injection | ✅ Pure |
| Scototaxis | AOTU → DN | ✅ Pure |
| Escape | LC4 → DNp04 | ✅ Pure |
| Landing | Geometric → DN | ⚠️ Soft stub |
| Takeoff | Hunger → DNb01/02 | ⚠️ Soft gate |

**BANNED**: chemotaxis_gain, dist<ε cheats, teleport, direct fly control.

---

## Performance

| Config | Time/step | FPS | Mode |
|--------|-----------|-----|------|
| 1 fly | 3.3 ms | ~300 | Live sandbox |
| 20 flies | ~66 ms | ~15 | Batch + replay |

- **Live sandbox**: 1-fly realtime for tutorial
- **Level play**: Batch N=20, then replay (not 20 live brains)

---

## Demo Levels

| Level | Demonstrates | Escape Rate |
|-------|--------------|-------------|
| **Shadow Corridor** | Scototaxis | 20% ★ |
| **Dead End Trap** | Aversive chemotaxis | 0% (hard) |
| **Long Hallway** | Flight necessity | 20% ★ |
| **Light vs Dark** | Scototaxis conflict | 0% (hard) |

**Quirky behaviors** (tech demo gold):
- Flies get within 80px of exit but fail
- Shadow hugging visible
- Trap attraction genuine
- Takeoff drama from threats

---

## 3-Slice Ladder

| Slice | Deliverable | Kill Gate |
|-------|-------------|-----------|
| **01** | SoftInterfaceRegistry + InjectBundle + 1-fly live | 1-fly escapes |
| **02** | SwarmRunner + Stars + Exit Lock + Shadow Corridor | Swarm > 10% |
| **03** | 4 levels + ZapperPolicy + Turbo + Ship | All levels viable |

**Sequence**: 01 → 02 → 03 (strict order, kill gates block)

---

## Reading Order

For a new agent with no chat context:

1. **This file** (`HANDOFF.md`) — You are here
2. **[DECISIONS.md](DECISIONS.md)** — Key chat decisions
3. **[spikes/README.md](spikes/README.md)** — Spike doc index
4. **[spikes/GAME_DESIGN.md](spikes/GAME_DESIGN.md)** — Product vision
5. **[README.md](README.md)** — Full spec with slices
6. **[slices/01-cutover-sandbox.md](slices/01-cutover-sandbox.md)** — First implementation slice

### Quick Reference

| Question | Document |
|----------|----------|
| What is this game? | HANDOFF.md (this file) |
| What decisions were made? | DECISIONS.md |
| What neural pathways work? | spikes/SPIKE_LEARNINGS.md |
| What parameters can I tune? | spikes/BALANCE.md |
| What are the product locks? | spikes/GAME_DESIGN.md |
| What was derisked? | spikes/MECHANICS_DERISK.md |
| What's the implementation plan? | README.md + slices/ |

---

## Key Constraints

1. **Pure graph motor** — All behavior from MaleCNS LIF, no external cheats
2. **70k neuron limit** — visual_motor subgraph, no expansion without OOM check
3. **Soft stubs registered** — All geometric→neural boundaries in SoftInterfaceRegistry
4. **Kill gates block** — Cannot proceed to next slice until gate passes
5. **No shop UI** — Toolkit placement via level JSON or code, not UI

---

## Contact

- **Product owner**: David
- **Spike code**: This repo (`src/`)
- **Spec**: `specs/help-the-fly-escape/`

---

## ⚠️ Implementation Status

**SPEC COMPLETE — DO NOT IMPLEMENT UNTIL DAVID SAYS GO**

When David gives the go signal:
1. Read README.md Next Agent Prompt
2. Execute Slice 01
3. Pass kill gate
4. Execute Slice 02
5. Pass kill gate
6. Execute Slice 03
7. Ship
