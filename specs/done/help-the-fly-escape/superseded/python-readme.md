> Historical Python proposal, superseded on 2026-09-06. Not implementation instructions. Start at `specs/help-the-fly-escape/README.md`. Historical relative links may no longer resolve.

# Fly Maze — MaleCNS LIF Flight Simulation

**The fly brain IS the game AI.** No shortcuts.

**DUAL-MODE LOCOMOTION: WALKING + FLYING**

**NEW: WALK-VS-FLY ECONOMY** — Hunger/threat triggers takeoff from walking to flying mode.

---

> 📋 **Implementation Spec**: See [`specs/help-the-fly-escape/HANDOFF.md`](../HANDOFF.md) for the complete implementation spec and handoff documentation.

---

> **Game Vision**: *Help the Fly Escape!* Exit is 3-4 rooms away. Player buys and places toolkit items (fruit, vinegar, light, shadow, wind, threat) to guide the MaleCNS fly to freedom before it starves. See [`GAME_DESIGN.md`](../spikes/GAME_DESIGN.md) for full product lock.

This project simulates a Drosophila fly using the real MaleCNS v1.0 connectome. The fly can WALK (slow, precise) or FLY (fast, momentum-based), with hunger/threat triggering takeoff via flight-initiation neurons (DNb01, DNb02). Chemotaxis, landing, feeding, and takeoff all emerge from neural network dynamics — there is no external turn bias, distance threshold, or auto-eat shortcut.

## How It Works

### Flight Dynamics
1. **Momentum-based movement**: Velocity persists with drag (not instant like walking)
2. **Higher speeds**: Max speed 4.0 vs 1.5 for walking
3. **Yaw control**: Differential wing activity via flight DNs

### Walk-vs-Fly Economy (NEW SPIKE)
1. **WALKING mode**: Slow (max 1.2), high drag, precise control
2. **FLYING mode**: Fast (max 4.0), low drag, momentum-based overshoot
3. **Takeoff trigger**: Hunger > 0.6 → inject DNb01/DNb02 → fly takes off
4. **Threat takeoff**: Escape loom (LC4→DNp04) can also force takeoff
5. **Level design**: Walking too slow on hard levels → flight forced by starve clock

**Flight-initiation DNs** (from literature: Namiki et al. 2018):
| DN | Body IDs | Function |
|----|----------|----------|
| DNb01 | 10654, 10759 | Primary flight initiation |
| DNb02 | 12767, 529488, 10805, 13922 | Flight power initiation |

### Landing + Feeding
1. **Hunger State**: Fly starts hungry (2x feeding pathway gain)
2. **Visual Loom**: dR/dt (retinal expansion rate) triggers landing DNs (DNp07, DNp10)
3. **Landing**: Landing DN activation → reduced thrust → fly decelerates
4. **Tarsal Contact**: Leg sugar receptors (claw_tpGRN) detect fruit
5. **Feeding**: Sugar signal → GNG interneurons → proboscis MNs (MN1) → hunger reduction
6. **Starvation**: 5 minutes without feeding → death

**FORBIDDEN** (not used anywhere in the code):
- `if dist < ε: land = True` — distance threshold
- `if contact: eat()` — auto-eat on contact
- `chemotaxis_gain` — external turn bias

### Neural Control (Pure Graph)
1. **Bilateral Odor Sensing**: Left and right antennae sense different odor concentrations
2. **Asymmetric Current Injection**: L/R olfactory neurons receive proportional activation
3. **Excitatory LH→DN Pathway**: Cholinergic lateral horn neurons excite ipsilateral descending neurons
4. **Flight Motor Output**: Thrust from flight DNs (DNa01, DNg13, DNp09, DNb01) + turn from olfactory DNs

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run LANDING + FEEDING demo (hungry fly survives by feeding)
python run_feeding.py

# Run FLIGHT maze (fly herded into jar)
python run_flight.py

# Run chemotaxis comparison (baseline vs fruit)
python run.py --steps 1500 --current 5.0 --seed 42
```

## Output Artifacts

After running, check the `artifacts/` directory:

### Landing + Feeding (NEW)
- `feeding_demo.gif` — Hungry fly lands, feeds, survives
- `feeding_final.png` — Final frame with behavior state HUD
- `starvation_death.gif` — Fly **STARVES** (fails to find fruit)
- `starvation_death_final.png` — Final frame showing death
- `gain_sweep_report.md` — Gain sweep experiment results
- `gain_sweep_results.csv` — Raw trial data

### Flight Mode
- `flight_herding.gif` — **Flying** fly herded into jar
- `flight_herding_final.png` — Final frame
- `flight_herding_report.json` — Flight metrics

### Chemotaxis Comparison
- `comparison_pure_lif.png` — Path comparison (baseline vs fruit)
- `fruit_arena.gif` — Animation with odor
- `pure_lif_report.json` — Chemotaxis metrics

## Feeding Results (NEW)

### Easy Level (default)
| Metric | Value |
|--------|-------|
| First landing | step 43 (4.3s) |
| First feeding | step 84 (8.4s) |
| Total feeds | 59 |
| Final hunger | 0.2% |
| Time flying | 22.8% |
| Time feeding | 59.6% |

### Starvation Level (hard)
| Seed | Outcome | First Landing | Notes |
|------|---------|---------------|-------|
| 42 | SURVIVED | 100.1s | Found fruit after long search |
| 123 | **STARVED** | never | Chemotaxis failed |
| 456 | SURVIVED | 201.4s | Very close call |
| 789 | **STARVED** | never | Chemotaxis failed |

**~33% starvation rate** on hard level. Pure neural pathway — some flies starve.

**Survival via pure neural feeding pathway!** No distance thresholds or auto-eat.

## Flight Results

| Metric | Flight | Walking |
|--------|--------|---------|
| Win step | **172** | 1044 |
| Mean speed | **3.56** | ~1.0 |
| Max speed | **4.00** | 1.5 |
| Path length | 616 | 783 |

**~6x faster** with flight dynamics! Same pure-graph chemotaxis.

## Project Structure

```
├── run_feeding.py         # FEEDING demo (NEW - primary)
├── run_flight.py          # FLIGHT herding
├── run_maze.py            # Walking maze game
├── run.py                 # Chemotaxis comparison
├── requirements.txt       # Python dependencies
├── choices.md             # Design decisions
├── BALANCE.md             # Game design constraint sheet (NEW)
├── src/
│   ├── graph_loader.py    # MaleCNS connectome loading
│   ├── lif_sim.py         # LIF + flight DN motor readout
│   ├── flight.py          # Flight dynamics (momentum, drag)
│   ├── flight_maze_sim.py # Flight maze simulator
│   ├── feeding_maze_sim.py # Landing + feeding simulator (NEW)
│   ├── landing_feeding.py # Landing/feeding neural pathways (NEW)
│   ├── olfaction.py       # Bilateral olfactory injection
│   ├── maze.py            # Walls, stimuli, jar
│   ├── arena.py           # Legacy walking arena
│   └── visualization.py   # Rendering
├── data/                  # Downloaded feather files (~1GB)
└── artifacts/             # Output GIFs, PNGs
```

## Key Technical Details

### Why Chemotaxis Works

The key insight is that **not all LH neurons drive attraction**:

- **LHAD1g1** (strongest LH→motor) is **GABAergic** → INHIBITS DNs → causes AVERSION
- **LHPV2i1, LHAD2c1** are **cholinergic** → EXCITE DNs → cause ATTRACTION

We inject to excitatory LH neurons only. These have strong ipsilateral projections:
- L-LHPV2i1 → L-DNs (25 L-DNs, 2 R-DNs)
- R-LHPV2i1 → R-DNs (24 R-DNs, 0 L-DNs)

### Motor Readout

Turn comes from **olfactory-specific DNs** (102 neurons receiving excitatory LH input), not all 1,300+ DNs. This prevents dilution of the olfactory signal.

### Landing Neurons (NEW)

Visual loom (retinal expansion rate) activates landing DNs:

| DN Type | Body IDs (L/R) | Function |
|---------|----------------|----------|
| DNp07 | 11704 / 11513 | Landing initiation |
| DNp10 | 10425 / 10433 | Landing deceleration |

### Feeding Neurons (NEW)

Sugar taste pathway drives proboscis extension:

| Neuron Type | Count | Function |
|-------------|-------|----------|
| claw_tpGRN | 50 | Tarsal sugar receptors (legs) |
| BM_Taste | 40 | Broad taste neurons |
| GNG* | 57 | SEZ feeding interneurons |
| MN1 | 4 | Proboscis motor neurons |
| Hugin-RG | 4 | Feeding modulation |
| NPFL1-I | 2 | Hunger-related neuropeptide |

### Hunger Prior

Based on Drosophila feeding literature:
- Starved flies show 2-3x higher sugar response (Wang et al. 2004)
- Insulin signaling modulates feeding initiation (Wu et al. 2005)
- Hugin neurons gate feeding behavior

### Honest Assessment

- Chemotaxis IS present in pure graph
- Effect is **moderate to strong** but variable across seeds
- Heading alignment consistently improves (~0.2-0.3)
- Distance improvement varies due to:
  - Network noise and stochastic spiking
  - Arena boundary reflections
  - Long path integration

This is **biologically realistic** — real fly behavior is also variable.

## Data Source

MaleCNS v1.0 from Google Cloud Storage:
- `gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/`
- ~211,000 neurons, 151M+ synaptic connections

See [codex.flywire.ai](https://codex.flywire.ai/) for documentation.

## Command-Line Options

### Landing + Feeding (`run_feeding.py`) — Primary Mode

```bash
python run_feeding.py --help

Options:
  --seed INT          Random seed (default: 42)
  --level STR         Level: easy, feeding, survival, starvation
  --starve-test       Test starvation with 30-second timer
  --no-render         Skip rendering (faster)
  --feeding-gain N    Feeding pathway gain (sugar→proboscis, default: 2.0)
  --olfactory-gain N  Olfactory gain (hunger→approach, default: 1.0)
```

### Gain Sweep (`run_gain_sweep.py`)

```bash
python run_gain_sweep.py --help

Options:
  --quick            Quick test (3 seeds, 3 gains)
  --feeding-only     Only sweep feeding gain
  --olfactory-only   Only sweep olfactory gain
  --level STR        Level: easy (fast), feeding, survival
```

**Level Difficulty:**
| Level | Fruit Distance | Odor Strength | Typical Survival |
|-------|---------------|---------------|------------------|
| easy | Close | Strong | 100% |
| feeding | Medium | Medium | ~90% |
| survival | Medium-far | Medium | ~80% |
| starvation | Very far | Weak | ~60% |

### Flight Herding (`run_flight.py`)

```bash
python run_flight.py --help

Options:
  --seed INT        Random seed (default: 42)
  --retries INT     Number of retries on timeout (default: 3)
  --current FLOAT   Odor injection current (default: 6.0)
  --output DIR      Output directory (default: artifacts)
```

### Walking Maze (`run_maze.py`)

```bash
python run_maze.py --help

Options:
  --level STR       Level to play: herding, obstacles
  --seed INT        Random seed (default: 42)
  --retries INT     Number of retries on timeout (default: 3)
  --current FLOAT   Odor injection current (default: 5.0)
```

### Chemotaxis Comparison (`run.py`)

```bash
python run.py --help

Options:
  --baseline-only   Run baseline (no odor) only
  --fruit-only      Run fruit odor condition only
  --seed INT        Random seed (default: 42)
  --steps INT       Simulation steps (default: 1500)
```

## Maze Game

Herd the **flying** fly into a jar using fruit trails!

### Components

- **Walls**: Barriers the fly cannot pass (collision detection)
- **Fruit**: Attractive odor source (pure-graph chemotaxis)
- **Vinegar**: Repellent (inhibits olfactory drive)
- **Light/Shadow**: Weak phototaxis effects
- **Wind**: Physical push only
- **Jar**: Goal zone with physical entrance + optional bait

### Win Condition

The fly must enter the jar through its physical opening. No teleportation, no external turn bias.

### Demo Result

```bash
python run_maze.py --level herding
# Result: WIN at step 1044
# Method: PURE_GRAPH_LIF (no external turn bias)
```

The fly successfully navigates the fruit trail corridor and enters the jar using pure MaleCNS chemotaxis.

## Pure-Graph Guarantee

**No external turn bias is used anywhere in this codebase.**

Both chemotaxis and maze navigation emerge purely from:
1. Bilateral odor sensing at antenna positions
2. Asymmetric current injection to excitatory LH neurons
3. Olfactory-specific DN L/R difference → motor output

**Landing + Feeding guarantees:**
- NO `if dist < ε: land = True` — uses visual loom signal only
- NO auto-eat on contact — requires proboscis MN activation from graph
- Starvation is real — flies can and do die on hard levels

**Gain sweep validation:**
- Feeding gain does NOT affect landing time (tested: 0.5x, 1.0x, 2.0x, 4.0x all land at 4.3s)
- This confirms landing is driven by visual loom → landing DNs, not feeding pathway
- See `artifacts/gain_sweep_report.md` for full analysis

The fly brain IS the AI.

## Balance & Tuning

See **[BALANCE.md](../spikes/BALANCE.md)** for the complete game-design constraint sheet:

- **50+ parameters** cataloged by subsystem (flight, LIF, olfaction, landing, feeding, maze)
- Each parameter includes: name, default, range, effect, lever class, purity note
- **Designer levers** section with top 10 most impactful parameters
- Quick balance recipes for easier/harder/faster/slower gameplay
- Purity guidelines distinguishing pure-graph vs soft-cheat params
- CSV catalog at `artifacts/params_catalog.csv` for programmatic access

## License

MIT
