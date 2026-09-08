> Historical spike evidence only. Browser scope and current contracts live in [the browser spec](../README.md). Claims below require reproduction; they are not release guarantees or current build instructions.

# BALANCE.md — Fly Maze Game Design Constraint Sheet

This document catalogs **every tweakable parameter** in the simulation, organized by subsystem. Use this as a reference for level design, tuning, and understanding the levers available for game balance.

---

## Parameter Legend

| Column | Description |
|--------|-------------|
| **Name** | Code path / CLI flag / config field |
| **Default** | Current default value |
| **Range** | Safe/meaningful range |
| **Effect** | What it changes in fly behavior (player-visible) |
| **Lever Class** | `physics` · `neural_inject` · `motor_readout` · `level_design` · `economy` · `debug` |
| **Purity** | ✅ Pure graph · ⚠️ Soft cheat · ❌ Breaks purity |

---

## 1. Flight Physics

Parameters in `src/flight.py` → `FlightParams`

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `FlightParams.max_speed` | 4.0 | 1.0–10.0 | Maximum flight velocity; higher = faster traversal, overshooting fruit | physics | ✅ |
| `FlightParams.max_angular_speed` | 0.25 | 0.1–0.5 | Max turn rate (rad/step); higher = tighter turns, more responsive | physics | ✅ |
| `FlightParams.drag` | 0.03 | 0.01–0.2 | Velocity decay per step; higher = slower, more "sticky" movement | physics | ✅ |
| `FlightParams.angular_drag` | 0.1 | 0.05–0.3 | Angular velocity decay; higher = turns damp faster | physics | ✅ |
| `FlightParams.thrust_gain` | 0.15 | 0.05–0.5 | DN activity → acceleration; higher = more responsive to neural thrust | motor_readout | ✅ |
| `FlightParams.turn_gain` | 0.08 | 0.02–0.2 | L/R asymmetry → yaw rate; higher = stronger chemotaxis turns | motor_readout | ✅ |
| `FlightParams.dt` | 1.0 | 0.1–2.0 | Physics timestep; affects simulation speed | physics | ✅ |
| `FlightParams.min_speed` | 0.5 | 0.0–1.0 | Minimum speed when thrusting; prevents stalling in flight | physics | ✅ |

### Collision Physics (hardcoded in `FlightDynamics.apply_collision`)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| Collision speed retention | 0.6 | 0.3–0.9 | Fraction of speed kept after wall bounce | physics | ✅ |
| Heading randomization | ±0.3 rad | 0.0–0.5 | Random heading offset after collision | physics | ✅ |

### Walk-vs-Fly Economy (NEW SPIKE)

Parameters in `src/flight.py` → `WalkParams` and `src/landing_feeding.py` → `LandingFeedingParams`

**WALKING mode** — slow, precise ground locomotion:

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `WalkParams.max_speed` | 1.2 | 0.5–2.0 | Walk top speed; ~3× slower than flight | physics | ✅ |
| `WalkParams.drag` | 0.15 | 0.1–0.3 | Ground friction; ~5× higher than flight | physics | ✅ |
| `WalkParams.angular_drag` | 0.2 | 0.1–0.4 | Angular damping when walking | physics | ✅ |
| `WalkParams.thrust_gain` | 0.08 | 0.04–0.15 | DN → acceleration (lower = precise) | motor_readout | ✅ |
| `WalkParams.turn_gain` | 0.06 | 0.03–0.12 | L/R → yaw rate (lower = tight turns) | motor_readout | ✅ |
| `WalkParams.min_speed` | 0.0 | 0.0 | Can stop completely when walking | physics | ✅ |

**TAKEOFF gates** — hunger/threat triggers flight:

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `takeoff_hunger_threshold` | 0.6 | 0.3–0.9 | Hunger level to start takeoff drive | neural_inject | ⚠️ Soft |
| `takeoff_hunger_gain` | 10.0 | 5.0–20.0 | Hunger → DNb01/DNb02 injection current | neural_inject | ✅ |
| `takeoff_threat_gain` | 15.0 | 5.0–25.0 | Escape loom → takeoff boost | neural_inject | ✅ |
| `takeoff_dn_threshold` | 0.5 | 0.3–0.8 | DN activity to trigger actual takeoff | neural_inject | ⚠️ Soft |

**Purity notes**:
- ✅ DNb01/DNb02 are real flight-initiation neurons (Namiki et al.)
- ⚠️ Hunger threshold is soft (no hunger→DN pathway in subgraph)
- ✅ Dual kinematics are physics-based (no cheats)

**Game feel**:
- Walking is slow but controlled — good for precise navigation
- Flying is fast but overshoots — needs landing to stop
- Hunger pressure forces takeoff on hard levels

---

## 2. LIF Neural Simulation

Parameters in `src/lif_sim.py` → `LIFParams`

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `LIFParams.tau` | 20.0 | 5.0–50.0 | Membrane time constant (ms); higher = slower integration, smoother responses | neural_inject | ✅ |
| `LIFParams.threshold` | 1.0 | 0.5–2.0 | Spike threshold; lower = more active network | neural_inject | ✅ |
| `LIFParams.reset` | 0.0 | -0.5–0.0 | Post-spike membrane reset; negative = hyperpolarization | neural_inject | ✅ |
| `LIFParams.dt` | 1.0 | 0.1–2.0 | LIF timestep | neural_inject | ✅ |
| `LIFParams.refractory` | 2 | 1–5 | Refractory period (steps); higher = lower max firing rate | neural_inject | ✅ |
| `LIFParams.noise_std` | 0.015 | 0.0–0.1 | Membrane noise; higher = more random behavior | neural_inject | ✅ |
| `LIFParams.input_scale` | 0.0002 | 0.0001–0.001 | Synaptic input scaling; affects how strongly spikes propagate | neural_inject | ✅ |
| `LIFParams.baseline_drive` | 0.05 | 0.0–0.2 | Tonic background drive; keeps network active | neural_inject | ✅ |

### Motor Readout Weights (hardcoded in `LIFSimulator.compute_flight_motor_output`)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| Flight thrust weight | 1.5 | 0.5–3.0 | Weight of flight DNs in thrust computation | motor_readout | ✅ |
| General thrust weight | 0.5 | 0.2–1.0 | Weight of general DNs in thrust | motor_readout | ✅ |
| Flight turn weight | 0.5 | 0.2–1.0 | Weight of flight DNs (L/R) in turn | motor_readout | ✅ |
| Olfactory turn weight | 1.0 | 0.5–2.0 | Weight of olfactory DNs in turn (main chemotaxis signal) | motor_readout | ✅ |

---

## 3. Chemotaxis / Olfaction

Parameters in `src/olfaction.py` → `BilateralOlfactoryInjector`

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `ANTENNA_OFFSET` | 20.0 | 5.0–50.0 | Bilateral separation of virtual antennae; higher = stronger L/R gradient detection | neural_inject | ✅ |
| LH→motor multiplier | 8.0 | 2.0–20.0 | Injection strength to excitatory LH neurons; main chemotaxis driver | neural_inject | ✅ |
| ORN/PN injection scale | 1.0× | 0.5–2.0 | Relative strength of ORN/PN injection vs LH | neural_inject | ✅ |

### Odor Source Parameters (per-stimulus in `src/maze.py`)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `Stimulus.intensity` | 1.0 | 0.1–3.0 | Odor strength; higher = stronger chemotaxis pull | level_design | ✅ |
| `Stimulus.sigma` | 50.0 | 20.0–150.0 | Odor spread (Gaussian σ); higher = detectable from farther | level_design | ✅ |
| `Stimulus.x`, `y` | varies | arena bounds | Odor position; determines fly's path target | level_design | ✅ |

### Exit Near-Field Magnet (NEW)

The EXIT stimulus type creates a near-field attractive odor at the exit zone.

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| EXIT `intensity` | 1.5 | 1.0–2.0 | Pull strength when close | level_design | ✅ |
| EXIT `sigma` | 50 | 30–80 | **CRITICAL**: Small = near-field only | level_design | ✅ |

**Design intent**:
- σ=50 means fly must be ~50 units away to sense exit strongly
- 3-4 rooms away (~600+ units), exit is invisible to fly
- Player must use toolkit to guide fly close enough to "smell freedom"
- NOT a house-wide magnet — that would trivialize the puzzle

### Glomerulus Tuning (`GLOMERULUS_TUNING` dict)

| Glomerulus | Key Odorant | Sensitivity | Effect | Purity |
|------------|-------------|-------------|--------|--------|
| DM1 | ethyl_butyrate | 0.9 | Fruit-ester response | ✅ |
| DM2 | ethyl_acetate | 0.95 | Strong fruit response | ✅ |
| DM3 | isoamyl_acetate | 0.7 | Banana-like | ✅ |
| DM4 | ethyl_butyrate | 0.6 | Secondary fruit | ✅ |
| DM5 | ethyl_acetate | 0.8 | Multi-ester | ✅ |
| DL1 | methylbutyl_acetate | 0.8 | Apple-like | ✅ |
| DL5 | ethyl_acetate | 0.65 | Secondary | ✅ |
| DC2 | isoamyl_acetate | 0.55 | Weak banana | ✅ |
| VA6 | methylbutyl_acetate | 0.7 | Apple variant | ✅ |

---

## 4. Landing / Loom

Parameters in `src/landing_feeding.py` → `LandingFeedingParams`

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `fruit_radius` | 20.0 | 10.0–50.0 | Assumed visual size of fruit for loom calculation | neural_inject | ✅ |
| `loom_threshold` | 0.02 | 0.005–0.1 | Min loom rate (dR/dt) to trigger landing; lower = lands from farther | neural_inject | ✅ |
| `loom_gain` | 15.0 | 5.0–50.0 | Loom→DN injection current; higher = stronger landing response | neural_inject | ✅ |
| `landing_thrust_reduction` | 0.85 | 0.5–1.0 | Thrust multiplier during landing; 0.85 = 15% thrust | motor_readout | ✅ |
| `landing_settle_time` | 20 | 10–50 | Steps to fully land; affects landing duration | physics | ✅ |

### Landing DN Threshold (hardcoded in `update_behavior_state`)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| Landing DN activity threshold | 0.3 | 0.1–0.6 | Min DN activity + loom to start landing | motor_readout | ✅ |

### Loom Signal (⚠️ SOFT STUB)

The loom signal is computed **mathematically** from distance and velocity, not from visual neuron activity:

```
loom = dR/dt where R = 2 * arctan(fruit_radius / distance)
```

**Why This Is a Stub:**
- Real looming would flow: Photoreceptors → Medulla → LC neurons → Landing DNs
- LC neurons (especially LC16, LC4, LC6) are known looming detectors
- These exist in MaleCNS (4,257 LC neurons!) but NOT in motor1hop subgraph

**To Make Pure Graph:**
1. Expand subgraph to include LC neurons
2. Inject to R7/R8 photoreceptors based on retinal image
3. Let LC→DN pathway compute loom naturally
4. Remove external loom calculation

**Current Compromise:** Loom detection is external, but DN injection is through graph.

---

## 4b. Vision System (SPIKE FINDINGS — UPDATED)

### Visual Subgraph: `visual_motor`

**NEW**: Extended subgraph that includes LC→DN escape pathway.

| Type | In `visual_motor` | Total | Coverage | Notes |
|------|-------------------|-------|----------|-------|
| **LC4 (escape)** | **126** | 126 | **100%** | ✅ FULLY INCLUDED |
| LC6 (escape) | 107 | 124 | 86% | ✅ Mostly included |
| LC9 | 219 | 219 | 100% | Flight power |
| LC11 | 143 | 143 | 100% | — |
| **LC16 (landing)** | 25 | 182 | **14%** | ⚠️ Still low |
| LPLC | 417 | 417 | 100% | — |
| R7/R8 | 0 | 2,714 | 0% | Out of scope |

**Subgraph Stats**: 70,000 neurons, 798,422 edges, ~9.4 MB

### ✅ Escape Looming: NOW PURE GRAPH

**LC4→DNp04 Pathway WORKS!**

| DN Type | Baseline | LC4 Stimulated | Δ Spikes |
|---------|----------|----------------|----------|
| **DNp04** | 11 | **182** | **+171** |
| DNp01 | 12 | 100 | +88 |
| DNp02 | 8 | 75 | +67 |
| Total | 54 | 502 | **+829%** |

**How to Use**:
1. Compute loom signal externally (dR/dt)
2. Inject to **LC4 neurons** (not DNs directly)
3. LC4→DNp04→motor pathway handles escape
4. This is visual-layer injection, not DN soft stub

### ⚠️ Landing Looming: Still Soft Stub

LC16 (landing looming) is only 14% in subgraph because:
- LC16 mainly targets PVLP neurons, not DNp07/DNp10
- Path: LC16 → PVLP → ??? → DNp43 → MNs
- Requires different subgraph extraction

**Current approach**: External loom → DNp07/DNp10 injection (soft stub)

### ❌ Photoreceptor Pathway: Out of Scope

R7/R8 → DN requires 615,000 neurons (10x current subgraph):
- Layer 1: 42,268 (medulla)
- Layer 2: 569,826 (first reach DNs)

**Recommendation**: Keep light/shadow as soft stub.

### Designer Behavior Matrix — Vision (Updated)

| Stimulus | Detection | Behavior | Purity |
|----------|-----------|----------|--------|
| **THREAT (escape)** | **Geometric → LC4** | **Escape via DNp04** | **✅ Pure graph** |
| **SHADOW zone** | **Geometric → AOTU** | **Turn toward shadow (scototaxis)** | **✅ Pure graph** |
| Slow loom (landing) | External loom calc | Landing via DNp07/DNp10 | ⚠️ STUB |
| Light source | Olfactory proxy | Weak attraction | ⚠️ STUB |
| Wall proximity | Collision physics | Bounce/slide | ✅ (not visual) |

### AOTU Shadow Preference Parameters (NEW)

| Name | Suggested | Range | Effect | Lever | Purity |
|------|-----------|-------|--------|-------|--------|
| `aotu_gain` | 10.0 | 5.0–25.0 | Shadow → AOTU injection strength | neural_inject | ✅ |
| `shadow_intensity` | 1.0 | 0.5–2.0 | Shadow zone strength | level_design | ✅ |
| `shadow_sigma` | 60.0 | 30.0–120.0 | Shadow zone spread | level_design | ✅ |

**How Shadow Preference Works (Pure Graph)**:
1. Shadow zone on LEFT → detect shadow at left "eye"
2. Inject to AOTU_L neurons (251 in subgraph)
3. AOTU_L → DNa02_L, DNa03_L (ipsilateral activation)
4. LEFT DNs fire more → fly turns RIGHT → toward shadow

**Biological Note**: AOTU is the Anterior Optic Tubercle, part of the "anterior visual pathway" 
for heading/navigation. In real flies, it receives input from photoreceptors via MeTu neurons.

### Escape Loom Parameters (NEW)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `escape_loom_threshold` | 0.08 | 0.02–0.2 | Min loom rate for escape trigger | neural_inject | ✅ |
| `escape_loom_gain` | 20.0 | 5.0–50.0 | Loom → LC4 injection strength | neural_inject | ✅ |
| `threat_radius` | 50.0 | 20.0–100.0 | Assumed threat visual size | level_design | ✅ |

**Note**: Escape uses LC4→DNp04 (Giant Fiber) pathway. Produces startle/speedup response.
May compete with chemotaxis if fly is hungry and threat is between fly and food.

---

## 5. Feeding / Taste / Hunger

Parameters in `src/landing_feeding.py`

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `contact_radius` | 30.0 | 15.0–60.0 | Distance for tarsal contact with fruit; larger = easier feeding | physics | ⚠️ |
| `feeding_time` | 40 | 20–100 | Steps for one feeding bout to complete | economy | ✅ |
| `sugar_gain` | 12.0 | 5.0–30.0 | Sugar→GRN injection current; higher = faster feeding initiation | neural_inject | ✅ |

### Hunger State (`HungerState`)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `hunger.level` | 1.0 | 0.0–1.0 | Hunger intensity (1.0 = max hunger); affects feeding gain | economy | ✅ |
| `base_feeding_gain` | 2.0 | 1.0–8.0 | Hungry feeding multiplier (sugar→proboscis); higher = faster feeding | economy | ✅ |
| `base_olfactory_gain` | 1.0 | 0.5–4.0 | Hungry olfactory multiplier (approach motivation); higher = faster landing | economy | ⚠️ |
| Feed satiation amount | 0.3 | 0.1–0.5 | Hunger reduction per feed bout | economy | ✅ |
| Hunger increase rate | 0.0001 | 0.0–0.001 | Hunger increase per step (currently negligible) | economy | ✅ |

### CLI Gain Overrides (`run_feeding.py`)

| Flag | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `--feeding-gain` | 2.0 | 0.5–8.0 | Override base_feeding_gain | economy | ✅ |
| `--olfactory-gain` | 1.0 | 0.5–4.0 | Override base_olfactory_gain | economy | ⚠️ |

**Purity Note on Olfactory Gain**: Increasing `olfactory_gain` amplifies the odor signal, which can make chemotaxis artificially strong. Values >2.0 may be considered soft cheats depending on interpretation.

---

## 6. Starvation / Economy

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `starve_time_steps` | 3000 | 300–10000 | Steps until death without feeding (default = 5 min at 0.1s/step) | economy | ✅ |
| `step_to_seconds` | 0.1 | 0.05–0.5 | Mapping of sim steps to wall-clock seconds | debug | ✅ |
| `--starve-test` | false | bool | Short 30-second starvation timer for testing | debug | ✅ |

### Behavior State Thresholds

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| Contact→landed threshold | 0.5 | 0.2–0.8 | Contact strength to transition LANDING→LANDED | motor_readout | ✅ |
| Proboscis MN threshold | 0.1 | 0.05–0.3 | Min MN activity to initiate feeding | motor_readout | ✅ |
| Exit feeding threshold | 0.05 | 0.01–0.2 | Contact below this exits FEEDING state | motor_readout | ✅ |
| Abort landing timeout | 2× settle_time | — | Steps before failed landing aborts | physics | ✅ |

---

## 7. Maze / Level Layout

Parameters in `src/maze.py` → `Maze` and level creation functions

### Arena Geometry

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `Maze.width` | 500.0 | 300.0–1000.0 | Arena width; larger = more exploration | level_design | ✅ |
| `Maze.height` | 400.0 | 200.0–800.0 | Arena height | level_design | ✅ |
| `Maze.time_limit` | 3000 | 1000–10000 | Max steps before timeout | level_design | ✅ |
| `fly_start_x`, `y` | varies | arena bounds | Fly spawn position | level_design | ✅ |
| `fly_start_theta` | 0.0 | -π to π | Fly spawn heading (0 = right) | level_design | ✅ |
| Boundary border | 5.0 | 2.0–20.0 | Arena edge collision margin | physics | ✅ |

### Wall Parameters (`Wall` dataclass)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `Wall.x`, `y` | varies | arena bounds | Wall position (bottom-left corner) | level_design | ✅ |
| `Wall.width`, `height` | varies | 10.0–200.0 | Wall dimensions | level_design | ✅ |

### Jar Parameters (`Jar` dataclass)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `Jar.x`, `y` | varies | arena bounds | Jar center position | level_design | ✅ |
| `Jar.radius` | 30.0–40.0 | 20.0–80.0 | Jar size; larger = easier to enter | level_design | ✅ |
| `Jar.opening_direction` | π (left) | -π to π | Which way opening faces | level_design | ✅ |
| `Jar.opening_width` | 0.6 | 0.3–0.9 | Fraction of circumference open; higher = easier entry | level_design | ✅ |
| `Jar.has_bait` | true | bool | Whether jar has attractant | level_design | ✅ |
| `Jar.bait_intensity` | 0.5 | 0.1–1.5 | Bait odor strength | level_design | ✅ |

### Exit Room Layout Lock (NEW)

**DESIGN LOCK**: Exit door position and occlusion.

```
EXIT ROOM LAYOUT:
        ┌─────────────────┐
        │   OCCLUSION     │
────────┤   BAFFLE ▌      │    EXIT on RIGHT WALL
        │   doorway ↘     ├──☀ (can't see from hallway!)
        │                 │
        └─────────────────┘
```

| Rule | Reason |
|------|--------|
| Exit on **right wall** | Not visible from straight hallway approach |
| Entry from **left** | Fly must enter room to see exit |
| **Occlusion baffle** | Internal wall blocks LOS from doorway |
| **Near-field σ=50** | Exit only attracts when fly is IN room |

**Why this matters**:
- Trail of toolkit items REQUIRED to get fly to exit room
- Near-field magnet FINISHES escape, doesn't replace navigation
- No "long-range cheat" — exit doesn't pull from spawn

### Built-in Levels

| Level | Difficulty | Fruit Distance | Key Challenge |
|-------|------------|----------------|---------------|
| `easy` | Very Easy | ~120 units | Close fruit, no obstacles |
| `feeding` | Easy | ~120–270 units | Multiple fruits, simple corridor |
| `survival` | Medium | ~460 units | Winding path, must reach in time |
| `starvation` | Hard | ~700 units | Far weak fruit, maze obstacles |
| `herding` | Demo | fruit trail | Corridor leading to jar |
| `obstacle` | Medium | S-curve | Multiple barriers, vinegar traps |

---

## 8. Stimulus Types

| Type | Effect | Injection Target | Polarity | Purity |
|------|--------|------------------|----------|--------|
| `FRUIT` | Attractive chemotaxis + **LANDABLE** | Excitatory LH | + | ✅ |
| `CRUMB` | Attractive chemotaxis + **NOT landable** (trail marker) | Excitatory LH | + | ✅ |
| `VINEGAR` | **Aversive chemotaxis** | **Inhibitory LH (LHAD1g1)** | − | ✅ |
| `LIGHT` | Weak phototaxis | LH (as fruit proxy) | weak + | ⚠️ |
| `SHADOW` | Weak negative | Inhibitory LH | weak − | ⚠️ |
| `WIND` | **Dual effect** (see below) | N/A (physical) + odor advection | N/A | ✅ |
| `JAR_BAIT` | Weak fruit-like | LH | weak + | ✅ |
| **`THREAT`** | **Escape trigger** | **LC4 → DNp04 (Giant Fiber)** | escape | **✅** |
| `EXIT` | Near-field attract (small σ) | Excitatory LH | + | ✅ |
| **`ZAPPER`** | **☠️ LETHAL HAZARD** (contact kills) | N/A (environment) | death | ✅ |

**FRUIT vs CRUMB**: Use `FRUIT` for actual food sources (fly can land/feed). Use `CRUMB` for trail breadcrumbs (attract but don't trap the fly).

### Budget Economy (P0.2 Spike)

**Price List** (arbitrary units, needs tuning):

| Item | Price | Notes |
|------|-------|-------|
| `crumb` | $10 | Essential trail marker |
| `shadow` | $15 | Scototaxis zone |
| `vinegar` | $15 | Repellent |
| `light` | $15 | Avoidance zone |
| `threat` | $20 | Takeoff trigger |
| `fruit` | $25 | Landable (can trap fly) |
| `wind` | $30 | Physical push |

**Budget Tiers** (tentative):
- **Broke**: $30 — minimal trail only
- **Tight**: $60 — trail + 1 tool
- **Medium**: $120 — decent toolkit
- **Generous**: $200 — full toolkit
- **Unlimited**: no constraint

**P0.2 Finding**: Budget economy needs larger N testing. At N=3, results are too noisy to determine if puzzle depth exists.

### Fly Zapper Parameters (Environment Hazard)

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `zapper.sigma` | 20-25 | 10-40 | **Kill radius** (contact = death) | level_design | ✅ |
| `zapper.intensity` | 1.0 | 0.5-2.0 | Visual glow brightness | level_design | ✅ |
| `n_zappers` | 2-3 | 0-10 | Number of zappers per level | level_design | ✅ |
| `zapper_seed` | varies | any int | Randomizes zapper placement | level_design | ✅ |

**Placement**: Zappers are randomly scattered in "off-path" zones by level seed. NOT player-placed.

### Wind — Player Tool with TWO Effects (DESIGN LOCK)

Wind is a **player-placeable environmental tool** with two distinct effects:

#### Effect 1: Physical Body Push (Existing)
- Direct force on the fly's body
- Applied as thrust/lateral push based on wind direction and intensity
- Concentration falls off with Gaussian distance from wind source

#### Effect 2: Odor Advection (NEW)
- Wind **transports odor concentration fields** downwind
- Fruit, vinegar, and jar bait plumes stretch in wind direction
- This is **environmental smell transport**, NOT a DN turn cheat
- Fly still detects odor via bilateral antennae → pure-graph chemotaxis

**Wind Parameters:**

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `wind.direction` | 0.0 | -π to π | Wind flow direction (radians) | level_design | ✅ |
| `wind.intensity` | 1.0 | 0.1–3.0 | Wind strength (affects push + advection) | level_design | ✅ |
| `wind.sigma` | 50.0 | 20.0–150.0 | Wind zone size | level_design | ✅ |
| `wind.x`, `y` | varies | arena bounds | Wind source position | level_design | ✅ |
| `advection_strength` | 0.5 | 0.0–1.0 | How much wind stretches odor plumes | level_design | ✅ |

**Future/Optional:**
- Turbulence: random fluctuations in wind direction
- Intermittency: pulsed wind gusts
- Multiple wind sources with interaction

**BANNED:**
- Using wind direction to secretly inject a bearing→turn bias
- Any `turn += f(wind_direction, fly_heading)` outside the graph

### Vinegar — Pure Graph Aversion (IMPLEMENTED)

**Implementation (Pure Graph):**
- Vinegar (`acetic_acid` blend) → **inhibitory LH neurons** (GABAergic)
- **LHAD1g1** is the primary aversive neuron (~1700 weight to DNs)
- When activated, it **INHIBITS ipsilateral DNs**
- Contralateral side dominates → fly turns **AWAY** from vinegar
- Same purity bar as fruit attraction — no external turn bias

**Aversive Pathway:**
| Component | Neurons | Function |
|-----------|---------|----------|
| LHAD1g1 | L=10147, R=10297 | Primary inhibitory LH (GABAergic, ~1700 weight) |
| LHPV10c1 | L=13946, R=555875 | Secondary inhibitory LH (GABAergic, ~300 weight) |
| LHAV8a1 | L=512859, R=20270 | Tertiary (Glutamatergic, ~250 weight) |
| DC1, DC3, DC4 | various | Aversive glomeruli (respond to acetic_acid) |

**How It Works:**
1. Vinegar on LEFT side → more concentration at left antenna
2. Inject to LEFT inhibitory LH (LHAD1g1)
3. LEFT DNs get INHIBITED (GABA)
4. RIGHT DNs dominate
5. Fly turns RIGHT (AWAY from vinegar)

**Level Use:**
- Place vinegar to discourage wrong paths
- Creates "odor maze" where fly avoids certain areas
- Combine with wind advection to create complex odor landscapes

**Purity:** ✅ Pure graph (same mechanism as attraction, just opposite valence)

---

## 9. Subgraph / Motor1hop Mode

| Name | Default | Range | Effect | Lever | Purity |
|------|---------|-------|--------|-------|--------|
| `weight_threshold` | 3 | 1–10 | Min synapse weight for edges; higher = sparser graph | neural_inject | ✅ |
| Include olfactory | true | bool | Whether to include ORN/PN/LH/MBON pathways | neural_inject | ✅ |
| motor1hop subgraph size | ~61,840 neurons | — | Fixed by extraction algorithm | debug | ✅ |

---

## 10. CLI Flags Summary

### `run_feeding.py`

| Flag | Type | Default | Effect |
|------|------|---------|--------|
| `--data-dir` | str | "data" | Connectome data path |
| `--output-dir` | str | "artifacts" | Output artifact path |
| `--seed` | int | 42 | Random seed for reproducibility |
| `--level` | choice | "feeding" | Level preset: easy/feeding/survival/starvation |
| `--starve-test` | flag | false | Use 30-second starvation timer |
| `--max-steps` | int | level default | Override max simulation steps |
| `--no-render` | flag | false | Skip GIF/PNG generation |
| `--feeding-gain` | float | 2.0 | Sugar→proboscis pathway gain |
| `--olfactory-gain` | float | 1.0 | Hunger→approach pathway gain |

### `run_gain_sweep.py`

| Flag | Type | Default | Effect |
|------|------|---------|--------|
| `--quick` | flag | false | Fewer seeds/gains for fast test |
| `--feeding-only` | flag | false | Only sweep feeding gain |
| `--olfactory-only` | flag | false | Only sweep olfactory gain |
| `--level` | choice | "easy" | Level for sweep: easy/feeding/survival |

### `run.py` (basic chemotaxis)

| Flag | Type | Default | Effect |
|------|------|---------|--------|
| `--baseline-only` | flag | false | Skip fruit condition |
| `--fruit-only` | flag | false | Skip baseline condition |
| `--steps` | int | 1500 | Simulation steps |
| `--current` | float | 2.0 | Odor injection base current |
| `--download` | flag | false | Download data only |

---

## 11. Simulation Timebase

| Aspect | Value | Notes |
|--------|-------|-------|
| Default step duration | 0.1 seconds | `step_to_seconds` |
| Starvation time | 5 minutes | 3000 steps |
| Typical feeding demo | ~2–3 minutes | Easy level |
| Typical starvation failure | 5 minutes | Hard level |
| Rendering interval | every 5 steps | For GIF |
| Progress logging | every 500 steps | Console output |

---

## 12. Swarm Scoring Results (MEASURED)

Minimal house level with CRUMB trail (2000 max steps):

| Metric | N=5 | N=20 |
|--------|-----|------|
| **Escape rate** | 60% (⭐⭐) | 35% (⭐) |
| Starved | 0% | 0% |
| Timeout | 40% | 65% |
| Avg steps to escape | 1233 | 973 |
| Avg min distance | 123 | 136 |
| Time per fly | 17s | 17s |

**Star Thresholds**: ⭐ = 25%, ⭐⭐ = 50%, ⭐⭐⭐ = 75%

**Key Findings**:
- Non-landable CRUMB trail prevents fly from getting stuck
- Many flies get very close (min_dist 30-100) but timeout
- Zero starvation with proper trail placement
- ~17 seconds per fly at 2000 steps is acceptable for batch scoring

**Tuning Targets**:
- Increase exit near-field sigma for stronger pull
- Add more crumbs past baffle in exit room
- Consider increasing exit detection radius

---

## 13. Designer Levers (Top 12)

The most impactful parameters for level balance, ranked by "blast radius":

| Rank | Parameter | Lever Class | Impact | Use When |
|------|-----------|-------------|--------|----------|
| **1** | `Stimulus.intensity` | level_design | Controls chemotaxis strength | Balancing difficulty |
| **2** | `Stimulus.sigma` | level_design | Detection range | Easy (high) vs Hard (low) |
| **3** | `fly_start_x/y` | level_design | Starting distance to fruit | Initial challenge |
| **4** | `starve_time_steps` | economy | Time pressure | Difficulty scaling |
| **5** | `loom_threshold` | neural_inject | Landing trigger distance | Landing reliability |
| **6** | `FlightParams.turn_gain` | motor_readout | Chemotaxis responsiveness | Turn sharpness |
| **7** | `base_olfactory_gain` | economy | Hungry approach speed | Survival pressure |
| **8** | `wind.direction + intensity` | level_design | Plume advection + body push | Guiding/hindering fly |
| **9** | `contact_radius` | physics | Feeding zone size | Feeding reliability |
| **10** | `sugar_gain` | neural_inject | Feeding initiation speed | Feeding success rate |
| **11** | `Maze.time_limit` | level_design | Max allowed time | Level pacing |
| **12** | `vinegar placement` | level_design | Wrong-path discouragement | Maze complexity |

### Quick Balance Recipes

**Make Level Easier:**
- ↑ fruit intensity (1.5–2.0)
- ↑ fruit sigma (80–100)
- ↓ fly-to-fruit distance
- ↑ contact_radius (40+)
- ↓ loom_threshold (0.01)

**Make Level Harder:**
- ↓ fruit intensity (0.5–0.8)
- ↓ fruit sigma (30–40)
- ↑ fly-to-fruit distance
- ↓ contact_radius (20)
- ↑ loom_threshold (0.05)
- Add maze walls

**Speed Up Gameplay:**
- ↑ max_speed (5.0–6.0)
- ↑ thrust_gain (0.2)
- ↓ drag (0.02)

**Slow Down Gameplay:**
- ↓ max_speed (2.0–3.0)
- ↓ thrust_gain (0.1)
- ↑ drag (0.05)

**Use Wind to Guide:**
- Place wind upwind of fruit → stretches plume toward fly start
- Wind direction toward jar → helps fly find opening
- Combine with walls to create "odor corridors"

**Use Wind to Challenge:**
- Place wind blowing away from fruit → fly must fight wind
- Crosswind near walls → fly pushed into obstacles
- Wind + vinegar → deflect fly from shortcuts

**Use Vinegar to Block:**
- Place vinegar on wrong paths
- Combine with walls to create mandatory routes
- Lower intensity than fruit to allow "pushing through" if needed

---

## 13. Purity Guidelines

### ✅ Pure Graph (Safe to Tune)
These parameters affect physical simulation or neural injection without bypassing the graph:
- All `FlightParams`
- All `LIFParams`
- `loom_gain`, `loom_threshold`
- `sugar_gain`
- `base_feeding_gain`
- All level geometry

### ⚠️ Soft Cheats (Use Carefully)
These can make the simulation artificially easy without biological justification:
- `base_olfactory_gain` > 2.0 — amplifies chemotaxis beyond realistic
- `contact_radius` > 40 — makes feeding too easy
- `LIGHT`/`SHADOW` stimuli — ⚠️ SOFT STUB (uses olfactory pathway, not true phototaxis)
- `loom_signal` — ⚠️ SOFT STUB (computed mathematically, not from visual neurons)

### ❌ Forbidden (Would Break Purity)
These do NOT exist in the codebase by design:
- `chemotaxis_gain` — external turn bias from odor bearing
- `distance_to_land_threshold` — landing by distance, not loom
- `auto_eat_on_contact` — feeding without proboscis MN activation
- Bearing-based turn injection — any `turn += f(angle_to_fruit)`
- Wind-based turn cheat — any `turn += f(wind_direction, fly_heading)`
- Vinegar turn-away bias — any external repulsion force (use graph aversion instead)

---

## Appendix: Measured Effects from Gain Sweep

From `artifacts/gain_sweep_report.md`:

| Feeding Gain | Mean Land Time | Notes |
|--------------|----------------|-------|
| 0.5× | ~5.1s | No significant effect on landing |
| 1.0× | ~5.2s | (baseline) |
| 2.0× | ~5.1s | No significant effect on landing |
| 4.0× | ~5.0s | No significant effect on landing |
| 8.0× | ~5.1s | No significant effect on landing |

**Conclusion**: Feeding gain does NOT affect landing time (as expected — it's post-contact only).

| Olfactory Gain | Mean Land Time | Notes |
|----------------|----------------|-------|
| 1.0× | ~5.1s | (baseline) |
| 2.0× | ~4.8s | Slight improvement |
| 4.0× | ~4.5s | Faster landing |

**Conclusion**: Olfactory gain DOES speed landing (biologically plausible — hungry flies approach faster).

---

## Appendix: Implementation Status

### ✅ Implemented (Pure Graph)
- Fruit attraction via excitatory LH neurons
- Bilateral odor sensing with antenna offset
- Tarsal sugar → proboscis MN pathway
- Hunger modulation of feeding/olfactory gains
- Wind physical body push
- Wind odor advection
- **Vinegar aversion via inhibitory LH (LHAD1g1)** — PURE GRAPH
- **`visual_motor` subgraph** — LC→DN escape pathway (70k neurons)
- **Escape looming via LC4→DNp04** — PURE GRAPH (829% spike increase)
- **THREAT stimulus type** — triggers escape via LC4 (bilateral injection)

### ⚠️ Partial / Soft Implementation
- Landing loom → DNp07/DNp10: External loom calc, DN injection is through graph

### ✅ AOTU Scototaxis: IMPLEMENTED
- **AOTU → DNa02/DNa03** produces ipsilateral turning → shadow preference
- Light avoidance: AOTU injection from bright zones
- Shadow attraction: AOTU injection from shadow zones
- Detection is geometric; AOTU→DN pathway is pure graph
- See `SPIKE_LEARNINGS.md` section 6e for full test results

### 🆕 AOTU Scototaxis: IMPLEMENTED AND TESTED

**AOTU → DNa02/DNa03** produces ipsilateral turning → **SHADOW PREFERENCE (scototaxis)**

| Metric | Value |
|--------|-------|
| AOTU neurons in subgraph | L=123, R=128 (81% coverage) |
| Shadow preference | ✅ Working (fly ends in shadow zone) |
| Light avoidance | ✅ Working (fly stays far from light) |
| Chemotaxis vs scototaxis | Chemotaxis wins (fruit > shadow) |

**Purity**: ✅ Pure graph (AOTU→DN), ⚠️ shadow detection is geometric

**Test Results**:
- Shadow arena: Fly ends at x=62 (shadow at x=80) ✅
- Light arena: Fly ends at x=361 (light at x=80) ✅
- Conflict: All 3 seeds went to fruit despite bright zone

### 📋 TODO (Tracked)
- [ ] **Wind turbulence**: Optional random fluctuations in wind direction
- [ ] **Wind intermittency**: Optional pulsed wind gusts
- [x] **True phototaxis survey**: COMPLETED - AOTU→DN pathway found for SHADOW preference!
- [ ] **Positive phototaxis (toward light)**: BLOCKED - R7/R8 pathway needs 615k neurons
- [ ] **Landing via LC16**: Would need separate subgraph (LC16 only 14% covered)

### 🔬 Spike Findings (Track B - Phototaxis / Light-Shadow)

**Survey: Dm8 / Tm5c / MeTu / AOTU (Literature targets)**

| Type | Total | In `visual_motor` | Coverage | Direct → DN |
|------|-------|-------------------|----------|-------------|
| Dm8 | 1,104 | 0 | 0% | None (needs 2-hop) |
| Tm5c | 750 | 68 | 9% | Weak (14 weight) |
| MeTu | 1,009 | 23 | 2% | Weak (200 weight) |
| **AOTU** | **311** | **251** | **81%** | **MASSIVE (41,614 weight)** |
| LT11 | 2 | 2 | 100% | Weak (47 weight) |

**KEY FINDING: AOTU → DNa02/DNa03 is ACTIVE!**

Bilateral AOTU injection probe results:
| Condition | L DN spikes | R DN spikes | Ratio |
|-----------|-------------|-------------|-------|
| AOTU_L only | 37 | 4 | 9:1 L |
| AOTU_R only | 5 | 33 | 7:1 R |
| Baseline | 13 | 14 | ~1:1 |

**Interpretation**: AOTU produces **IPSILATERAL** DN activation → turn AWAY from stimulus
- This is **NEGATIVE PHOTOTAXIS** (photophobia / shadow preference)
- SHADOW → AOTU injection → turn TOWARD shadow ✅

**Pathway Summary:**
- LC19 → phototaxis DNs: WEAK (+13 spikes total)
- LC33 → DNa03: INHIBITORY (unexpected)
- aMe neurons: NO EFFECT on phototaxis DNs
- **✅ AOTU → DNa02/DNa03: STRONG IPSILATERAL ACTIVATION**

**Recommendation**:
- ✅ Shadow preference: Implement via bilateral AOTU injection (PURE GRAPH)
- ⚠️ Light attraction: Keep as soft stub OR use AOTU inhibition (partial)

### 📊 Subgraph Options

| Subgraph | Neurons | Use Case |
|----------|---------|----------|
| `motor1hop` | 65,000 | Olfaction + motor (original) |
| `visual_motor` | 70,000 | + LC→DN escape pathway |

---

*Document generated from codebase analysis. Last updated: 2026-09-05*
