# Mechanics Derisk Assessment

**Status**: SPIKE PHASE — derisk mechanics + spec only. Do NOT build full game.

---

## Verdict

✅ **Enough for interesting game** with swarm scoring on MaleCNS neural AI.

❌ **Not ready for implement-spec** until P0 spikes complete.

---

## P0 — Must Derisk Before Implement-Spec

### 1. CO₂ / IR / Humidity Survey (Biological Near-Field Exit Cue)

**Problem**: Current exit magnet uses fruit-odor proxy. Real flies use multiple cues to find exits:
- **CO₂ gradient** (outdoor air has lower CO₂)
- **IR / temperature** (warmth from outside)
- **Humidity** (outdoor air different moisture)

**Spike Goal**: Survey MaleCNS annotations for:
- CO₂-sensitive neurons (e.g., Gr21a/Gr63a ORNs, V glomerulus)
- Thermosensory neurons (hot/cold cells, AC neurons)
- Hygrosensory neurons (dry/moist cells)

**Success**: Document which cell types exist in MaleCNS and `visual_motor` subgraph. If present, design inject pathway. If missing, document gap and keep fruit-odor proxy (labeled).

**Status**: ✅ SURVEY COMPLETE

### Survey Results (P0.1)

| Modality | Cell Type | MaleCNS Total | In Subgraph | Usable? |
|----------|-----------|---------------|-------------|---------|
| **CO₂** | ORN_V | 55 | **0** | ❌ Missing |
| **CO₂** | V_ilPN, V_l2PN | 4 | **4** | ✅ Inject target |
| **Hygro (VL)** | ORN_VL1/2 | 225 | **0** | ❌ Missing |
| **Hygro (VL)** | VL1/2 PNs | 20 | **20** | ✅ Inject target |
| **Hygro (VP)** | VP2-5 PNs | 25 | **25** | ✅ Inject target |
| **Temp** | (any) | 0 | 0 | ❌ Not annotated |
| **Ionotropic (Ir)** | (any) | 0 | 0 | ❌ Not annotated |
| **Acidosis** | (any) | 0 | 0 | ❌ Not annotated |

**Key Finding**: ORNs (sensory input) are missing, but **projection neurons (PNs) are present**. 

**Potential Exit Cue Pathway** (same "downstream of missing input" pattern as LC4):
- CO₂ → inject V glomerulus PNs (V_ilPN, V_l2PN) — 4 neurons
- Hygro → inject VL/VP PNs — 45 neurons

**Verdict**: 
- ✅ **CAN probe** V/VL/VP PN injection for near-field exit cue
- ❌ **CANNOT** do temperature (not annotated)
- ⚠️ **Keep fruit-odor proxy** as fallback if PN inject doesn't produce behavior

---

### 2. Budget Economy Dry-Run (No UI)

**Problem**: Game design assumes budget + shop, but we haven't validated:
- What budget values make levels interesting?
- Which toolkit items are must-haves vs. luxury?
- Does economy create meaningful choices?

**Spike Goal**: Hardcode 3-5 budget scenarios on house level:
- Tight budget (can only afford 2-3 items)
- Medium budget (5-6 items)
- Generous budget (unlimited)

Run swarm tests, measure escape rate per budget. Find the "interesting" budget range where choices matter.

**Success**: Document budget thresholds that create tension. No UI needed.

**Status**: ✅ COMPLETE

### P0.2 Results

**Price List** (arbitrary units):
| Item | Price | Priority |
|------|-------|----------|
| crumb | $10 | Essential trail marker |
| shadow | $15 | Scototaxis zone |
| vinegar | $15 | Repellent |
| light | $15 | Avoidance zone |
| threat | $20 | Takeoff trigger |
| fruit | $25 | Landable (can trap fly) |
| wind | $30 | Physical push |

**Budget Tier Results** (N=3 flies, 1000 steps):

| Tier | Budget | Spent | Escape Rate | Stars |
|------|--------|-------|-------------|-------|
| broke | $30 | $30 | 0% | ❌ |
| tight | $60 | $60 | 0% | ❌ |
| medium | $120 | $105 | 33% | ★ |
| generous | $200 | $130 | 0% | ❌ |
| unlimited | $9999 | $130 | 0% | ❌ |

**Findings**:
- ⚠️ **High variance** at N=3 makes results noisy
- Medium outperformed generous/unlimited (likely random noise)
- **Puzzle depth unclear** — need larger N and better trail placement
- More crumbs ≠ better outcome (placement matters more than quantity)

**Recommendation**: Rerun with N=10+ and varied trail configurations before concluding economy is broken or valid

---

### 3. Zapper × Trail Escape-Rate Interaction

**Problem**: Zappers kill flies, trail guides flies. Need to understand:
- How does zapper placement affect escape rate?
- Can trail routing avoid zappers effectively?
- What's the "fair" zapper density?

**Spike Goal**: Run matrix of (n_zappers, trail_config) × escape_rate:
- n_zappers: 0, 1, 2, 3, 5
- trail_config: current tuned trail vs. alternative routes
- Measure: escape rate, zap rate, starve rate

**Success**: Document the zapper density that's challenging but fair (target ~50% escape with good trail).

**Status**: ✅ COMPLETE

### P0.3 Results

**Zapper Comparison** (N=3 flies, 1000 steps, matched seeds):

| Config | Escaped | Zapped | Stars |
|--------|---------|--------|-------|
| Zappers OFF | 67% (2/3) | 0% | ★★ |
| Zappers ON (3) | 0% (0/3) | **100%** (3/3) | ❌ |

**Findings**:
- ⚠️ **Zappers are TOO DEADLY** at 3 zappers — 100% zap rate
- Flies got zapped in 73-284 steps (very early)
- Current zapper placement is **RNG death**, not interesting detours
- Trail does NOT route around zappers effectively

**Recommendations**:
1. **Reduce zapper density**: Try 1 zapper per level instead of 3
2. **Shrink zap radius**: Current σ=20 may be too large
3. **Place zappers intentionally**: Move to true dead-ends, not near main corridor
4. **Add fly zapper avoidance?**: Could inject weak UV loom to make fly slightly avoid (but adds complexity)

**Verdict**: Zappers need tuning before they're interesting. Current config is unfair

---

## P1 — Derisk After P0

| Spike | Goal | Notes |
|-------|------|-------|
| Multi-room trail optimization | Find trail configs that hit star thresholds | Current 35% escape needs tuning |
| Threat placement patterns | Document effective threat positions for takeoff | When/where does threat help vs. hurt? |
| Scototaxis × chemotaxis conflict | Quantify which wins when competing | Fruit in light vs. shadow elsewhere |
| Wind advection tuning | Find wind strengths that meaningfully move plumes | Currently stubbed |

---

## P2 — Nice to Have

| Spike | Goal | Notes |
|-------|------|-------|
| Vinegar aversive tuning | Find repel strength that redirects without blocking | Currently weak |
| Landing precision | Reduce fruit overshoot | Walk-vs-fly tradeoff |
| Hunger curve shapes | Test different hunger decay rates | Linear vs. exponential |

---

## SKIP (Out of Scope for Spike)

| Item | Reason |
|------|--------|
| Shop UI | No UI work in spike phase |
| Dm8 full phototaxis | Blocked (not in subgraph); AOTU scototaxis is sufficient |
| 100-fly optimization | 20-fly batch is sufficient for spike; optimization is implementation |
| Campaign/levels | Spike validates mechanics, not content |
| Art/audio | Spike is mechanics + spec |

---

## Current Mechanic Status

| Mechanic | Status | Purity | Notes |
|----------|--------|--------|-------|
| Chemotaxis (fruit) | ✅ Working | ✅ Pure graph | Bilateral LH injection |
| Chemotaxis (aversive) | ✅ Working | ✅ Pure graph | Inhibitory LH |
| Scototaxis (shadow) | ✅ Working | ✅ Pure graph | AOTU → DNa02/03 |
| Escape loom | ✅ Working | ✅ Pure graph | LC4 → DNp04 |
| Landing loom | ⚠️ Soft stub | ⚠️ Geometric → DN | No LC16 path |
| Feeding | ✅ Working | ⚠️ Threshold-gated | GRN → proboscis |
| Walk-vs-fly | ✅ Working | ⚠️ Soft takeoff gate | DNb01/02 injection |
| Starve timer | ✅ Working | ✅ Pure | 5-min clock |
| Zappers | ✅ Working | ✅ Pure | Contact = death |
| Exit magnet | ⚠️ Working | ⚠️ Fruit-odor proxy | Needs CO₂/IR survey |
| Wind advection | 🔲 Stubbed | — | Not implemented |

---

## Measured Baselines

| Metric | Value | Level |
|--------|-------|-------|
| Escape rate (no zappers) | 35% (N=20) | Minimal house |
| Escape rate (2 zappers) | 0% (N=5) | Minimal house |
| Zap rate (2 zappers) | 80% (N=5) | Minimal house |
| Time per fly (2000 steps) | ~17s | Minimal house |
| LIF step time | 2.7ms | Any |
| Full sim step | 3.3ms | Any |

---

## P0 Complete — Level Playtest Pass

**PRIORITY REFRAME** (David): #1 goal = cool simulation / tech demo. Game only needs to be playable and somewhat fun. Quirks are OK (even desirable).

### Level Designs (4 layouts)

| Level | Layout | Demonstrates | Escape Rate | Demo Worthy? |
|-------|--------|--------------|-------------|--------------|
| **Shadow Corridor** | 3-room with shadow zones | Scototaxis | 20% ★ | ✅ Yes |
| **Dead End Trap** | Tempting fruit trap + vinegar | Aversive chemotaxis | 0% | ⚠️ Hard |
| **Long Hallway** | Very long corridor | Flight necessity | 20% ★ | ✅ Yes |
| **Light vs Dark** | Forking paths (lit vs shadow) | Scototaxis conflict | 0% | ⚠️ Hard |

### Quirky Behaviors (Tech Demo Gold!)

- **"So close!"** — Flies frequently get within 80-90px of exit but don't escape. The baffle works!
- **Multiple takeoffs** — Nervous fliers take off 3+ times in a run
- **Near-exit starve** — Tragic deaths within sight of freedom

### Tech Demo Assessment

**Working well**:
- Scototaxis (shadow preference) clearly visible
- Chemotaxis trail guidance works
- Takeoff from threat triggers flight
- Baffle creates interesting navigation challenge

**Quirks (desirable)**:
- Flies sometimes ignore stronger crumbs for shadow
- Dead-end traps are genuinely tempting
- High fail rate adds drama

**Balance verdict**: "Somewhat balanced" — 2/4 levels winnable (20%), 2/4 very hard. Good for demo showing real fly brain quirks.

### Recommendations for Demo

1. **Lead with Shadow Corridor** — clearest scototaxis demo
2. **Long Hallway shows flight** — needs takeoff to win
3. **Dead End Trap is dramatic** — show flies getting trapped, even if 0% escape
4. **Light vs Dark shows conflict** — even when fly loses, behavior is interesting

---

## Appendix: Annotation Survey Raw Data

### CO₂ Sensing (V Glomerulus)

```
ORN_V: 55 neurons in MaleCNS (CO₂ receptor ORNs)
  - In visual_motor subgraph: 0 ❌

V glomerulus PNs: 21 neurons in MaleCNS
  - V_ilPN: 2 (both in subgraph ✅)
  - V_l2PN: 2 (both in subgraph ✅)
  - Other V types: 16 in subgraph ✅
```

### Hygrosensory (VL/VP Glomeruli)

```
VL glomerulus ORNs: 225 neurons in MaleCNS
  - ORN_VL1: 82 (0 in subgraph ❌)
  - ORN_VL2a: 98 (0 in subgraph ❌)
  - ORN_VL2p: 45 (0 in subgraph ❌)

VL glomerulus PNs: 18 neurons in MaleCNS
  - VL1_ilPN: 2 (2 in subgraph ✅)
  - VL1_vPN: 2 (2 in subgraph ✅)
  - VL2a_adPN: 2 (2 in subgraph ✅)
  - VL2a_vPN: 6 (6 in subgraph ✅)
  - VL2p_adPN: 2 (2 in subgraph ✅)
  - VL2p_vPN: 4 (4 in subgraph ✅)

VP glomerulus PNs: ~25 neurons in subgraph ✅
  - VP2-VP5 PNs all present
```

### Thermosensory

```
No dedicated thermosensory neurons found in annotations.
AC/hot/cold cell types: 0 matches
Arista neurons: 0 matches
Sacculus neurons: 0 matches

Note: Thermosensory neurons may exist but are not annotated with 
recognizable type names, or are in antenna (not MaleCNS brain).
```
