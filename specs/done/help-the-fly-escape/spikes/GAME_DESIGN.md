> Historical spike evidence only. Browser scope and current contracts live in [the browser spec](../README.md). Claims below require reproduction; they are not release guarantees or current build instructions.

# GAME_DESIGN.md — Fly Maze Product Vision

**PRODUCT LOCK** — This document captures the core game design. Changes need David's approval.

---

## The Game: Help the Fly Escape

**Premise**: A fly is trapped in a house. Help it escape.

**Goal**: Guide the MaleCNS fly to the **exit** (door/window/open zone) before it starves.

**The catch**: The exit is **3–4 rooms away** from spawn — too far for the fly to sense directly. The fly brain (MaleCNS LIF) is the AI; player cannot control it directly.

**The player's role**: Buy and place toolkit items to create a path of sensory cues that guide the fly through the house to freedom.

---

## Core Loop

```
1. View the house (multi-route, 3-4 rooms)
2. Assess room types (light, shadow, attract, repel, dead ends)
3. Spend budget on toolkit items
4. Place items in rooms (floor/table surfaces)
5. Watch the MaleCNS fly navigate
6. Win: Fly reaches exit before starve timer
   Lose: Fly starves (5 minutes) or gets stuck
7. Retry with different placement strategy
```

---

## House Structure

### Rooms
- **3–4 rooms** between spawn and exit
- Each room is an **obstacle type**:
  - Light room — fly avoids (scototaxis via AOTU)
  - Shadow room — fly lingers (shadow preference)
  - Attract room — has fruit/bait (chemotaxis pull)
  - Repel room — has vinegar (aversive chemotaxis)
  - Dead end — no exit, wastes fly's time
  - Neutral — open corridor, no bias

### Multi-Route
- Multiple paths to exit (not a single corridor)
- Player chooses which paths to enable/disable with placement
- Some routes are faster but harder to guide
- Some routes are longer but easier to control

### Exit
- **Door**, **window**, or **open zone** — fly escapes when crossing threshold
- Optional: weak bait near exit to draw fly close
- Not directly sensible from spawn (too far away)

### Fly Zappers (Environment Hazard)

☠️ **Lethal zones** scattered throughout the house:

| Aspect | Details |
|--------|---------|
| Placement | **Randomly scattered** by level seed (not player-placed) |
| Visual | UV/blue glow — player-visible hazard indicator |
| Effect | **Contact = instant death** (distinct from starve) |
| Radius | ~20-25 units (fly must avoid, not just brush past) |

**Game impact**:
- Hurts swarm score (dead fly ≠ escaped fly)
- Trail placement must route AROUND zappers
- Adds environmental risk to navigation
- Each level seed has different zapper layout

**NOT a shop buy** — zappers are fixed hazards, not player tools.

---

## Toolkit (Player Items)

Player buys items with a **budget** and places them anywhere in rooms.

| Item | Effect | Pure Graph? | Cost (TBD) |
|------|--------|-------------|------------|
| **Fruit** | Attractive odor → chemotaxis pull | ✅ Excitatory LH | $$ |
| **Vinegar** | Aversive odor → chemotaxis repel | ✅ Inhibitory LH | $$ |
| **Light** | Bright zone → fly avoids | ✅ AOTU scototaxis | $ |
| **Shadow** | Dark zone → fly lingers | ✅ AOTU scototaxis | $ |
| **Wind** | Physical push + odor advection | ✅ Environmental | $$ |
| **Threat** | Escape loom → **flee + TAKEOFF** | ✅ LC4→DNp04→DNb01 | $$$ |
| **Exit Bait** | Weak fruit near exit | ✅ Same as fruit | $ |

### Threat as Takeoff Helper

**Threat** is a dual-purpose toolkit item:

1. **Flee**: Fly turns away from threat (escape loom via LC4→DNp04)
2. **Takeoff**: Escape response triggers flight initiation (DNp04→DNb01/DNb02)

**Use case**: Long hallways where walking is too slow
- Place threat behind fly → spooks into flight
- Fly covers distance faster, beats starve clock
- Combines with walk-vs-fly economy

**Placement strategy**:
- Behind fly to push forward (not blocking exit path)
- In dead ends to discourage entry
- Timed/pulsed threat for repeated takeoff boosts (future)

### Placement Rules
- Items can be placed on floor/table surfaces in any room
- Multiple items per room allowed
- Items persist until fly wins/loses
- No repositioning once placed (commit to strategy)

---

## Economy

### Budget
- Player starts with fixed budget (e.g., $100)
- Each item has a cost
- Cannot exceed budget
- No earning mid-round (fixed resources)

### Price List (P0.2 Spike)

| Item | Price | Notes |
|------|-------|-------|
| crumb | $10 | Trail marker (non-landable) |
| shadow/vinegar/light | $15 | Zone effects |
| threat | $20 | Takeoff trigger |
| fruit | $25 | Landable (can trap) |
| wind | $30 | Physical push |

### Difficulty via Budget
- **Broke** ($30): 2-3 crumbs only — barely functional trail
- **Tight** ($60): Trail + 1 special item
- **Medium** ($120): Decent toolkit coverage
- **Generous** ($200): Full toolkit freedom

### P0.2 Spike Finding
Budget economy needs larger N testing. At N=3 flies, variance too high to validate puzzle depth. Rerun with N=10+ before concluding economy is valid or broken.

---

## Swarm Scoring (PRODUCT ADD)

**Don't rely on one deterministic fly.** Neural noise is a feature.

### Setup
- Place **~20 flies** on the same toolkit layout
- Each fly has an **independent seed** (different neural noise)
- All flies start at same spawn, face same items
- Flies run in parallel (conceptually) or sequential (for perf)

### Scoring
- **Score** = number of flies that reach exit before starve
- Example: 14/20 flies escaped → 70% success rate

### Pass Thresholds (Stars)
| Stars | Success Rate | Meaning |
|-------|--------------|---------|
| ⭐ | 25%+ (5/20) | Minimal — layout works sometimes |
| ⭐⭐ | 50%+ (10/20) | Decent — layout is reliable |
| ⭐⭐⭐ | 75%+ (15/20) | Excellent — robust strategy |

### Why Swarm?
- **Neural noise**: LIF baseline_drive + noise_std create variability
- **Chemotaxis variance**: Same odor, different fly paths
- **Robustness test**: Good placement works for most flies, not just one lucky seed
- **Replayability**: Can't memorize "the path" — must design for variance

### Display (Future UI)
- Show all 20 paths overlaid (spaghetti plot)
- Highlight successes (green) vs failures (red)
- Score breakdown: "14/20 survived, 6 starved"

---

## Win/Lose Conditions

### Win (Per Fly)
- Fly reaches **exit** (crosses door/window threshold)
- Any time before starve timer
- **The fly escapes!** 🪰🚪

### Lose (Per Fly)
- **Starve**: 5-minute timer expires without feeding
- **Zapped**: Fly contacts a fly zapper (instant death)
- **Stuck**: Fly trapped in dead end or loop (soft lose — can happen)

### Level Pass (Swarm)
- Meet star threshold for the level
- Example: Level requires ⭐⭐ (50%) to unlock next

### Retry
- Soft retry: Reset all flies, keep same items
- Full retry: Reset everything, try new strategy

---

## Walk-vs-Fly Economy (Supports "Long Commute")

**Why dual locomotion matters for this game**:

1. **Long distances** (3-4 rooms) require flight for speed
2. **Precise navigation** (doorways, corridors) requires walking
3. **Hunger pressure** forces takeoff when walking is too slow
4. **Threat items** can force immediate takeoff (escape response)

| Mode | Use Case |
|------|----------|
| Walking | Navigate tight spaces, doorways, precise turns |
| Flying | Cross rooms quickly, escape threats, beat starve clock |

**Takeoff triggers**:
- Hunger high → DNb01/DNb02 → takeoff
- Threat loom → LC4→DNp04 → escape takeoff
- Wind assist (optional physics)

---

## Purity Bar (NON-NEGOTIABLE)

All fly behavior must emerge from MaleCNS neural dynamics:

| Behavior | Implementation | Purity |
|----------|----------------|--------|
| Chemotaxis (attract) | Bilateral ORN → LH → DN | ✅ Pure graph |
| Chemotaxis (avert) | Bilateral ORN → inhibitory LH | ✅ Pure graph |
| Scototaxis (shadow) | Geometric → AOTU → DN | ✅ Pure graph |
| Escape (threat) | Geometric → LC4 → DNp04 | ✅ Pure graph |
| Landing | Geometric loom → DNp07/DNp10 | ⚠️ Soft stub |
| Feeding | Sugar → GRN → GNG → MN1 | ✅ Pure graph |
| Takeoff | Hunger → DNb01/DNb02 | ⚠️ Soft threshold |

**BANNED**:
- `chemotaxis_gain` or external turn bias
- `if dist < ε: land/eat` distance thresholds
- Direct fly control by player
- Teleporting fly to exit

---

## Play Modes (UX LOCK)

Two distinct modes for different player goals:

### Live Sandbox = TUTORIAL (1 Fly, Realtime)

**Purpose**: Tutorial mode — let the user **feel the brain** before tackling levels.

| Aspect | Details |
|--------|---------|
| Flies | **1** (single brain) |
| Simulation | **Realtime** (~3.3 ms/step measured) |
| Interaction | Drop fruit/threat/shadow, see behavior change **immediately** |
| Budget | Unlimited or generous |
| Goal | Learn how the fly brain responds — no pass/fail pressure |

**Why sandbox = tutorial**:
- User drops fruit → sees fly turn toward it → "ah, chemotaxis!"
- User drops threat → sees fly flee → "ah, escape response!"
- Builds intuition for level play strategy

**Why this works technically**: At 3.3 ms/step (measured), one fly runs at ~300 FPS — easily realtime.

### Level Play (Swarm, 2-Phase)

**Purpose**: Scored challenge — design a robust strategy.

| Phase | What Happens |
|-------|--------------|
| **1. Place** | Budget mode, drag toolkit items, no simulation running |
| **2. Run** | Click "Run" → simulate N≈20 flies → watch replay |

| Aspect | Details |
|--------|---------|
| Flies | **~20** (independent seeds) |
| Simulation | **Batch** then **replay** (not 20 live brains) |
| Interaction | Place-only during Phase 1, watch-only during Phase 2 |
| Budget | Fixed per level |
| Goal | Meet star threshold (25%/50%/75% escape rate) |

**Why 2-phase**: 20 flies at 3.3 ms/step = ~66 ms/step total (~15 FPS). Interactive but laggy. Better to batch-simulate, then replay at smooth framerate.

### Optional: Turbo Sim + Playback

For long starve clocks (5 minutes = 3000 steps at 0.1s/step):
- **Turbo**: Run simulation at max speed (no rendering), save paths
- **Playback**: Replay saved paths at 1x/2x/4x speed with full rendering

This lets players see results quickly without watching 5 real minutes of fly wandering.

### Performance Budget (Measured)

| Config | Time/step | FPS | Mode |
|--------|-----------|-----|------|
| 1 fly | 3.3 ms | ~300 | ✅ Live sandbox |
| 5 flies | ~17 ms | ~60 | ✅ Interactive |
| 20 flies | ~66 ms | ~15 | ⚠️ Batch + replay |
| 100 flies | ~330 ms | ~3 | ❌ Turbo only |

---

## UI (Future — Not Blocking Spike)

### Phase 1 (Spike)
- No shop UI
- Level JSON defines items and placement
- Console output for metrics

### Phase 2 (MVP)
- Simple item palette
- Click-to-place on room floor
- Budget display
- Timer display

### Phase 3 (Polish)
- Visual item previews
- Drag-and-drop
- Undo placement
- Strategy hints

---

## Art & Vibe (ART LOCK)

**Tone**: Whimsical, warm, hopeful — you're *helping* the fly escape.

### The Exit Glow
- Exit door/window **glows bright warm orange**
- Almost "fly going to heaven" when it escapes
- Interior is **cooler/muted** so the glow reads clearly
- Creates visual pull toward freedom

### Color Language
| Element | Color | Purpose |
|---------|-------|---------|
| **Exit** | Warm orange glow | "This way to freedom" — player beacon |
| **Interior** | Cool/muted tones | Contrast, makes exit pop |
| **Fly path** | Subtle trail | Show where fly has been |
| **Success** | Golden burst | Celebration when fly escapes |

### Orange Exit = Near-Field Brain Magnet (LAYOUT LOCK)

The orange glow is **both visual AND neural** — but only at close range AND with line-of-sight.

**Exit Door Position (LOCKED)**:
```
        ┌─────────────────┐
        │   EXIT ROOM     │
        │                 ├──☀ EXIT (right wall)
HALLWAY─┤                 │   (orange glow)
        │                 │
        └─────────────────┘
```

- Exit door is on the **RIGHT WALL** of the final room
- Hallway enters from the **LEFT** (not opposite the door)
- From hallway: fly **CANNOT see/sense** the exit (no LOS, no attract)
- Fly must **enter the room** to get near-field attract

| Position | Effect |
|----------|--------|
| **In hallway** | No exit attract — door is around the corner |
| **Enter room** | LOS to exit → near-field attract kicks in |
| **Near exit** | Strong pull → fly commits and escapes |

**Implementation**:
- Exit zone has a **local fruit-like odor cue** (small sigma, ~50-80 units)
- Occlusion: hallway wall blocks LOS from approach
- When fly enters room and has LOS, it "smells freedom"
- Uses same pure-graph chemotaxis (excitatory LH) — NOT a distance cheat

**Why occlusion matters**:
- Trail is REQUIRED to get fly to final room
- Near-field only FINISHES the escape, doesn't replace toolkit
- Player can't rely on exit magnet pulling fly from hallway

### Mood
- Cozy house interior (the fly's prison)
- Warm inviting exterior (freedom awaits)
- Tension: Will the fly make it before starving?
- Relief: The moment the fly crosses into the light

---

## Demo Levels (Playtest Pass)

**PRIORITY**: Cool simulation / tech demo. Quirks are OK!

### Level 1: Shadow Corridor ★
- 3-room layout with shadow zones
- Demonstrates: **scototaxis** (shadow preference)
- Escape rate: ~20%
- Tech demo gold: Watch fly hug shadows

### Level 2: Dead End Trap
- Tempting fruit in dead end, vinegar guard
- Demonstrates: **aversive chemotaxis**, trap behavior
- Escape rate: ~0% (intentionally hard)
- Tech demo gold: Dramatic trap failures

### Level 3: Long Hallway ★
- Very long corridor, sparse crumbs
- Demonstrates: **flight necessity** (walk too slow)
- Escape rate: ~20%
- Tech demo gold: Watch takeoff from threat

### Level 4: Light vs Dark Choice
- Forking paths: lit vs shadow
- Demonstrates: **scototaxis vs chemotaxis conflict**
- Escape rate: ~0% (intentionally hard)
- Tech demo gold: Watch fly choose shadow over stronger crumbs

---

## Open Questions

1. ~~Budget values~~: Price list drafted in P0.2 spike
2. **Room layouts**: Hand-crafted for demo, procedural later?
3. **Feeding en route**: Can fly feed on placed fruit (resets hunger)?
4. **Wind mechanics**: How strong is odor advection?
5. **Threat placement**: Timing-based or persistent?

---

## Relationship to Spikes

| Spike | Feeds Game Design |
|-------|-------------------|
| Walk-vs-Fly | Long commute fantasy — fly must take off to cross rooms |
| Scototaxis | Light/shadow rooms as obstacle types |
| Escape Loom | Threat item forces takeoff/flee |
| Aversive Chemotaxis | Vinegar blocks wrong paths |
| Landing/Feeding | Fly can feed on placed fruit, reset hunger |

---

*Document created: 2026-09-06*
*Status: PRODUCT LOCK — David approved*
