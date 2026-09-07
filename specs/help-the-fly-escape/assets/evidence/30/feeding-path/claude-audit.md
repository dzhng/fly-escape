# Why campaign flies almost never eat

Read-only audit, worktree `/private/tmp/fly-claude-odor-history` @ `acebdfd`. No simulation
run, no production edits. Numbers are computed from the banked pilot raw
(`/tmp/claude-campaign-warmup/raw/*.json`), `data/processed/brain/{graph.bin,manifest.json}`,
and repo assets. Structural claims are wiring/code facts, not biological claims.

## 1. Exact mechanisms: what the spike had, what exists now

**A. Loom → landing DNs: the input is gone.** Historically `landing_feeding.py:367-425`
computed `loom = dR/dt` against the *nearest fruit* (`feeding_maze_sim.py:357-374, 391-408`)
and `:453-489` injected `loom × 15` into `LANDING_DN_LEFT/RIGHT` (DNp07/DNp10). Landing was
food-directed by construction. Today the only sensory inputs are `sensory.rs:21-60`
(ExcitatoryOdor / InhibitoryOdor / Vision) plus taste. The `loom` group — 126 neurons,
labelled "Approaching objects", present in the manifest — is referenced **only** by UI text
(`apps/web/src/science-panel.tsx:22,35,117`); no sim code injects it. Landing DNs are also
explicitly barred from all injection: `sensory.rs:118` lists `landingL`/`landingR`/`proboscis`
in `motor_readout_indices`, and `group_currents` filters them out. They can only be driven
synaptically.

**B. Sugar → GNG + proboscis MNs: two direct injections removed.** `landing_feeding.py:795-841`
injected tarsal GRNs, BM taste, *and* — above contact 0.2/0.3 while LANDED — GNG interneurons
and proboscis MNs directly. `attempt.rs:373-376` now injects only the `taste` group on food
contact. Manifest mapping: `taste` = TARSAL_GRN(3) ∪ BM_TASTE(16); `feeding` = GNG_INTERNEURON(10);
`proboscis` = PROBOSCIS_MN(4). Measured from `graph.bin`: `taste` has 280 out-edges, all
excitatory, and **zero** direct edges to `feeding` or `proboscis`; shortest `taste`→`proboscis`
path is 2 hops through unannotated neurons. The 4 proboscis MNs have 130 in-edges from 73
presynaptic neurons, only 2 of them annotated (proboscis recurrence). Feeding now requires that
2-hop propagation to fire ≥1 of 4 MNs within the same 0.1 s tick (`body.rs:537-538`,
threshold 0.2 → spike fraction 0.25).

**C. Hunger modulation: gone.** Historical `feeding_gain` (1–2×) and hunger→takeoff-DN drive
have no analogue; `taste_gain` is a constant (1 in the campaign) and reserve never modulates it.

**D. Attractive odor is bound to a wholly inhibitory group.** `sensory.rs:38-39` routes
`attractive_odor + exit_cue` to `odorInh`. Measured: `odorInhL/R` have 2225 out-edges, **all
negative** (sum −40 510); `odorExcL/R` have 1380, all positive. The only annotated one-hop
odor→landing edges are `odorExcL→landingL` (5) and `odorExcR→landingR` (3) — i.e. from the
*repellent* channel. `odorInh`→landing exists at 2 hops only. Connectivity, not causation.

**E. Contact geometry is far tighter and has a fatal interior.** Food contact is exact
mesh-vs-hull touching (`surface.rs:186-215`), gated on `Walking|Feeding` (`body.rs:437-438`) —
a fly flying directly over food registers nothing. From assets: the fly hull spans y 0→0.00303 m,
±0.0019 m laterally; the apple contact mesh has radius 0.0063 m at y=0, 0.0155 m at y=0.003,
reaching its 0.0414 m footprint only at y=0.040. So a grounded fly's touchable band is an
annulus of roughly r ∈ [0.006, 0.016] m at the apple's base — not the 0.041 m footprint — and
inside it `penetration_on` (`surface.rs:157-181`) raises the attempt-fatal "hull interior is
inside closed food". Historically contact was a graded disc of 1.5× the fruit radius with no
failure mode.

## 2. Measured vs inferred

**Measured** (255 running bodies across the 13 failure snapshots, plus run records):

- **Landing is not missing.** 110 Flying / 97 Walking / 48 Landing. Landing DNs fire routinely.
- **Landing is not food-directed.** Median distance to nearest edible mesh: Flying 3.44 m,
  Walking 3.52 m, Landing 3.67 m. Landing bodies are, if anything, farther from food.
- **Encounter rate is the binding constraint.** Of 255 bodies, 12 within 0.75 m of edible
  geometry, 2 within 0.30 m, 1 within 0.042 m. Of the 97 *grounded* bodies: **zero** within 0.30 m.
- The one fly that did reach edible geometry (warm60/apple/s100, 0.0156 m from the apple) was
  **Flying at height ≈0** — food contact impossible by `body.rs:437` — and its attempt died on
  the penetration error.
- **The chain does close.** The single meal (cold/apple/s105, fly 6, initial mode Walking) fed
  29 ticks ≈ 2.9 s (`maxBoutSeconds` 3), peak reserve 23.52, terminal tick 450 against a typical
  ~290. So taste → 2 hops → proboscis → Feeding works at least sometimes, and one meal is worth
  roughly +55% lifetime.
- **The level has almost no reachable food.** `food: []`; the only edibles are fixed `fruit`
  (7.4, 3.2) and `banana` (2.5, 8.0) — 4.3 m and 5.7 m from the spawn box — each with odor
  radius 0.75 m. Vision is not wired in campaign tuning, and `sources: []` with uniform
  `baselineBrightness: 1` means the vision→landing edges (the largest annotated input to
  `landingL/R`: 17 and 16 edges) would still see no L/R contrast if it were.

**Bounds on the above:** the 13 snapshots are failing cells only, one frame each at ticks
46–201; 20 flies per snapshot are not independent samples; n = 48 Landing bodies. The distance
comparison is a weak sample whose sign happens to be the opposite of the wanted one.

**Inferred, not measured here:** that a restored loom input would make landing food-directed;
the behavioural cost of the inhibitory binding in D (the prior `claude-history-audit.md` H1
covers that); any dynamics implied by edge counts or path lengths.

## 3. One recommendation (after the contact failures are fixed)

**Drive the existing `loom` group from a geometric nearest-edible expansion signal, and measure
one number: median distance-to-nearest-edible at Landing onset.**

One knob: a `CuePathway::Loom` whose current is the historical `dR/dt` against the nearest
*edible* surface only (`landing_feeding.py:395-425`), injected into the `loom` group and labelled
as a geometric→cell injection. Landing DNs stay uninjected, so the landing decision still comes
out of the graph (`loom`→`landing` is 2 hops; `loom`'s 7845 out-edges are all excitatory). Same
seeds, same plans, one level, loom-on vs loom-off.

Success = that median drops. Failure = it does not, which cleanly says the landing decision is
not loom-mediated in this graph and the remaining lever is level design — putting edible geometry
inside the reachable envelope (~30 s of reserve, ~1.6 cm grounded contact band, 0.75 m odor
radius), which is a content change, not a circuit one.

Explicitly rejected: any broad gain sweep (`gain-sweep.md` already shows a plateau above 1.5),
and any new framework.
