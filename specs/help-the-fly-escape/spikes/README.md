> Historical spike evidence only. Browser scope and current contracts live in [the browser spec](../README.md). Claims below require reproduction; they are not release guarantees or current build instructions.

# Spike Documentation Index

> **Origin `src/` is the spike code home** — all working code lives at repo root.
> These docs capture learnings, locks, and decisions from the spike phase.

---

## Timeline

| Date | Milestone | Docs |
|------|-----------|------|
| Sep 5-6, 2026 | Initial spike: chemotaxis, loom, flight | SPIKE_LEARNINGS.md |
| Sep 6, 2026 | Product locks: Help the Fly Escape | GAME_DESIGN.md |
| Sep 6, 2026 | P0 derisk complete | MECHANICS_DERISK.md |
| Sep 6, 2026 | Level playtest pass | SPIKE_LEARNINGS.md §11-12 |
| Sep 6, 2026 | Implementation spec complete | ../README.md |

---

## Document Index

### [GAME_DESIGN.md](GAME_DESIGN.md)
**Product vision and locks**
- The Game: Help the Fly Escape
- House structure, toolkit items
- Swarm scoring (N≈20, stars)
- Walk-vs-fly economy
- Purity bar (pure graph motor)
- Play modes (sandbox tutorial + level play)
- Art & vibe (orange exit glow)
- Exit layout lock (right wall + baffle)
- Demo levels

### [MECHANICS_DERISK.md](MECHANICS_DERISK.md)
**P0 spike results and derisk assessment**
- Verdict: Enough for interesting game
- P0.1: CO₂/IR/humidity survey (PNs present, ORNs missing)
- P0.2: Budget economy dry-run (price list, needs larger N)
- P0.3: Zapper × trail (3 zappers = RNG death)
- Level playtest results
- Measured baselines

### [SPIKE_LEARNINGS.md](SPIKE_LEARNINGS.md)
**Science diary — neural pathway discoveries**
- §1: Bilateral chemotaxis (excitatory LH)
- §2: Aversive chemotaxis (inhibitory LH, GABA)
- §3: Landing loom (DNp07/10)
- §4-6: Vision (phototaxis, LC4 escape, visual subgraph)
- §7: Wind advection (stubbed)
- §8: Feeding (GRN → proboscis)
- §9: Subgraph limitations
- §10: Failed paths
- §11: P0 derisk spikes
- §12: Level playtest pass
- §13: Zapper hazard

### [BALANCE.md](BALANCE.md)
**Game design constraint sheet**
- All tweakable parameters
- Stimulus types and neural targets
- Flight/walk physics
- Hunger/feeding economy
- Zapper parameters
- Budget economy (price list)
- Designer levers

### [choices.md](choices.md)
**Technical decision log**
- Odor→glomerulus mapping
- ORN/PN injection strategy
- Motor readout from DN/MN
- Subgraph construction choices
- Soft stub justifications

---

## Spike Code Location

All spike code lives at **repo root** (`/workspace/src/`):

| File | Purpose |
|------|---------|
| `src/graph_loader.py` | VisualMotorGraph (70k neurons) |
| `src/lif_sim.py` | LIF simulator |
| `src/feeding_maze_sim.py` | Game loop, state, collision |
| `src/landing_feeding.py` | Behavior states, injection |
| `src/flight.py` | Walk/fly dynamics |
| `src/maze.py` | Level structures, stimuli |
| `src/house_level.py` | Demo level definitions |
| `run_level_playtest.py` | Level playtest runner |
| `run_p0_spikes.py` | P0 spike tests |
| `run_swarm_test.py` | Swarm testing |

---

## Key Spike Findings

### Neural Pathways Discovered

| Pathway | Neurons | Status |
|---------|---------|--------|
| Chemotaxis (attract) | LHPV2i1, LHAD2c1 → DN | ✅ Pure graph |
| Chemotaxis (avert) | LHAD1g1 (GABA) → DN | ✅ Pure graph |
| Scototaxis | AOTU → DNa02/03 | ✅ Pure graph |
| Escape loom | LC4 → DNp04 | ✅ Pure graph |
| Landing | DNp07, DNp10 | ⚠️ Soft stub |
| Takeoff | DNb01, DNb02 | ⚠️ Soft gate |

### What Works

- Bilateral olfactory injection creates real chemotaxis
- LC4→DNp04 is the Giant Fiber escape pathway
- AOTU injection creates shadow preference
- Walk-vs-fly mode switching works
- 70k neuron subgraph runs at 3.3ms/step

### What's Missing

- R7/R8 photoreceptors (too large, ~615k)
- Dm8/Tm5c phototaxis (not in subgraph)
- CO₂ ORNs (present in MaleCNS, not in subgraph)
- Temperature neurons (not annotated)

---

## Relationship to Implementation Spec

These spike docs feed directly into the implementation spec:

| Spike Doc | Spec Section |
|-----------|--------------|
| GAME_DESIGN.md | Goals, non-goals, ownership invariants |
| MECHANICS_DERISK.md | Kill gates, deferred fog |
| SPIKE_LEARNINGS.md | Soft interface register |
| BALANCE.md | Playable parameters |
| choices.md | Seam implementations |

The spec slices (01-03) reference these docs for:
- Neural pathway body IDs
- Injection parameters
- Level definitions
- Purity classifications
