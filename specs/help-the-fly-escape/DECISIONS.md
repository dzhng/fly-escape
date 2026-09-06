# DECISIONS — Chat Decision Log

> **Key decisions from chat with David.** Reference when context is unclear.

---

## Decision Table

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| Sep 5 | **Pure graph chemotaxis** — Remove chemotaxis_gain, bearing-based turn bias | "The product story is real fly neurons as the game AI" | Core mechanic constraint |
| Sep 5 | **Bilateral olfactory injection** — Inject to L/R LH neurons based on antenna asymmetry | Creates turn toward odor through graph dynamics | Chemotaxis implementation |
| Sep 5 | **visual_motor subgraph** — 70k neurons including LC4→DN escape pathway | Full MaleCNS OOMs; need LC for pure-graph looming | Subgraph design |
| Sep 6 | **Flight dynamics** — Replace unicycle with momentum-based 2D flight | "The sim should be flying, not walking" | Flight physics |
| Sep 6 | **Landing + feeding** — Visual loom to DNp07/10, sugar to GRN→proboscis | Fly must land and feed to survive | Survival mechanic |
| Sep 6 | **5-minute starve timer** — Fly dies if no successful feed | Adds urgency, forces player strategy | Time pressure |
| Sep 6 | **Walk-vs-fly economy** — Dual kinematics with takeoff gates | Walking alone cannot beat hard layouts | Locomotion modes |
| Sep 6 | **Help the Fly Escape** — Reframe from jar trap to house exit | Fantasy is helping escape, not trapping | Game premise |
| Sep 6 | **Swarm scoring (N≈20)** — Independent seeds, probabilistic score | Neural noise is a feature, not a bug | Scoring system |
| Sep 6 | **Orange exit glow** — Near-field brain magnet, not house-wide | Exit attracts only when fly has LOS | Exit design |
| Sep 6 | **Exit layout lock** — Right wall, baffle blocks hallway LOS | Trail required to reach exit room | Level design |
| Sep 6 | **Fly zapper hazard** — Contact kills, randomly scattered | Environment risk, not player tool | Hazard type |
| Sep 6 | **ZapperPolicy(0-1)** — Limit to 0 or 1 zapper per level | 3 zappers = RNG death (unfair) | Balance |
| Sep 6 | **Sandbox = tutorial** — 1-fly live mode for learning | "Feel the brain" before levels | UX mode |
| Sep 6 | **Level play = 2-phase** — Place then batch-simulate swarm | Not 20 live brains (perf) | UX mode |
| Sep 6 | **Spike phase = derisk + docs** — NOT full game build | Maximize learning documentation | Development phase |
| Sep 6 | **P0 spikes before implement** — CO₂ survey, budget dry-run, zapper×trail | Must derisk before spec | Sequencing |
| Sep 6 | **#1 goal = tech demo** — Quirks OK, not chasing balance | Cool simulation over perfect game | Priority |
| Sep 6 | **4 demo levels** — Shadow Corridor, Dead End Trap, Long Hallway, Light vs Dark | Each demonstrates a neural behavior | Demo content |
| Sep 6 | **3-slice ladder** — Cutover → Swarm → Ship | Risk-first with kill gates | Implementation plan |
| Sep 6 | **Soft interfaces registered** — All geometric→neural in SoftInterfaceRegistry | Audit soft stubs, maintain purity | Code hygiene |
| Sep 6 | **DO NOT IMPLEMENT** — Spec complete, await go signal | David controls implement timing | Gating |

---

## Product Locks

These decisions are **LOCKED** — do not change without David's approval:

### Game Premise
- **Help the Fly Escape** (not trap in jar)
- Exit is 3-4 rooms away, occluded until final room
- Player buys/places toolkit items to guide fly

### Neural Purity
- All motor output from MaleCNS LIF graph
- No chemotaxis_gain or external turn bias
- No dist<ε landing/eating cheats
- Soft stubs must be registered and labeled

### Exit Design
- Exit on **right wall** of final room
- **Baffle** blocks hallway LOS
- **Near-field magnet** (small sigma ~40-50) only with LOS
- **Orange glow** — visual language for player

### Scoring
- **Swarm N≈20** with independent seeds
- **Stars**: 25% = ★, 50% = ★★, 75% = ★★★
- Quirks and variance are features

### UX Modes
- **Sandbox**: 1-fly realtime tutorial
- **Level play**: 2-phase place→batch→replay

---

## Technical Locks

### Subgraph
- **visual_motor** — 70k neurons
- Includes LC4→DNp04 (escape), AOTU (scototaxis)
- No expansion without OOM check

### Performance
- **3.3ms/step** (1-fly)
- **~66ms/step** (20-fly batch)
- Turbo sim for long starve clocks

### Soft Interfaces
Must register in SoftInterfaceRegistry:
1. LandingLoom (geometric → DNp07/10)
2. EscapeLoom (geometric → LC4)
3. Scototaxis (geometric → AOTU)
4. ExitMagnet (fruit proxy → LH)
5. TakeoffGate (hunger → DNb01/02)

---

## Out of Scope (David Confirmed)

| Item | Reason |
|------|--------|
| Shop UI | Not blocking tech demo |
| Dm8 phototaxis | Not in subgraph, AOTU sufficient |
| 100-fly batch | 20 sufficient |
| Campaign | Demo levels only |
| Procedural levels | Hand-crafted |
| Mobile/web | Desktop demo |

---

## Open Questions (Deferred)

| Question | Status |
|----------|--------|
| Optimal trail configs | Playtest found 20%, needs iteration |
| Budget economy depth | P0.2 showed noise at N=3 |
| CO₂/hygro exit cue | PNs available, fruit proxy works |
| Wind advection strength | Stubbed |
| Feeding en route | Can fly feed on placed fruit? |

---

## Decision Authority

- **Product decisions**: David
- **Technical implementation**: Agent (within spec)
- **Purity violations**: David must approve
- **Scope changes**: David must approve
- **Implementation timing**: David says go
