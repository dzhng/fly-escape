# Why earlier attraction "worked" and cold anatomical probes do not

Read-only audit, worktree `/private/tmp/fly-claude-odor-history` @ `7186df6`. No production edits. All numbers below are quoted from banked evidence or computed by me from banked evidence + the graph binary; derivations are marked.

---

## 1. Measured vs. inferred, historically

**Measured (Python era, `ae754b0:src/`)** — attraction was bound to the **excitatory** LH pathway: `get_bilateral_odor_currents` injects `left/right_excitatory_lh` at `lh_multiplier = 8.0`; `get_bilateral_aversive_currents` injects `left/right_inhibitory_lh` at `10.0` (`src/olfaction.py:200-217, 330-334, 402-408`). The turn readout is by construction the DNs fed by excitatory LH: `scripts/reference/lif_sim.py:36` ("DNs that receive input from excitatory LH neurons"), `turn = mean(V[olf_dn_r]) - mean(V[olf_dn_l])` (`lif_sim.py:229-232`). So every measured Python attraction result (fruit A/B 144→125; ATTRACT_VS_REPEL.md's 161.6→92.7 mean distance) was obtained driving the pathway the readout was *selected for*. That handoff's "vinegar is null" finding is the same fact seen from the other side.

**Measured (Rust, accepted)** — evidence/03 `review.md:13`: at 0.15 m antennae, 60-tick warmup, speed 0.12, the *inhibitory* pathway decreased min approach distance (−0.204 L, −0.373 R) and the excitatory pathway increased it. This single result is the entire empirical basis for the current inverted binding (`crates/sim/src/sensory.rs:16-18`: attractive odor → `odorInh*`, repellent → `odorExc*`).

**Inferred, never re-measured** — that the inhibitory pathway still produces *approach* at anatomical spacing. Slice 27 (`evidence/27/README.md`) is routinely cited as confirming this. It does not. `evidence/27/summarize.py:17,32` computes `expected*(delta[mirror=1]-delta[mirror=-1])/2` with `expected = -1` hard-coded for `inhibitoryOdor`. Slice 27 confirms **mirror separation with a pre-declared sign**; it measures no distance, alignment, or source-directed turn. Approach was measured once, at 0.15 m, and never again.

## 2. The decisive computed comparison

Slice 27's physical arm and the cold-odor probe use the *same* anatomical spacing (`physical_sampling.rs:14-15` = `FieldConfig::default()` at `environment/fields.rs:25-26`), the same fixture geometry and source (`field_lab.rs:116-127` vs `cold-odor/probe.rs:5-10`), the same 100-tick settle, same body integrator (`speed 0.12, turn_gain 8.0` — `chamber.rs:165-175` = `physical_sampling.rs:104-113`), same decoder. The prior run's "742× spacing / 5%→0.01% floor" hypothesis is **wrong**: slice 27's adopted numbers *are* the anatomical arm at the 0.01% cutoff.

Converting both to the same units (my computation, from `evidence/27/odor-confirm30-summary.json` `sideMeanDifferences` and `evidence/30/cold-odor/evidence.json` `meanTurn`):

| Pathway | slice-27 side +1 / −1 | cold side +1 / −1 | slice-27 signed | cold signed | reproduction |
|---|---|---|---|---|---|
| excitatory | +0.01629 / −0.00935 | +0.01658 / −0.00794 | +0.01282 | **+0.01226** | **96%** |
| inhibitory | −0.00428 / +0.01180 | +0.00075 / +0.00186 | +0.00804 | **+0.00056** | **7%** |

The excitatory arm reproduces essentially exactly warm→cold. The inhibitory arm collapses **14×** and one side **flips sign**. This is not a global regression from spacing, contrast floor, geometry, decoder, or speed — those are identical and would hit both arms. It is pathway-specific.

Gain is eliminated as the cause: `evidence/30/cold-odor/gain-sweep.md` shows cold gain 1 (−0.00073 / +0.00186) ≈ cold gain 2, while slice 27 ran gain 1. Detection is eliminated: inhibitory detected ticks 85–89 cold vs `meanActiveTicks` 90 in slice 27. Input is arriving.

## 3. Ranked hypotheses

### H1 (highest) — Attraction is bound to the pathway that is 6.9× less wired into the turn readout, and that margin is what the cold brain loses.

I measured one-hop signed weight from the sensory groups into `turnL/turnR` in `data/processed/brain/graph.bin` (scratch script, `/tmp/odor-audit/reach.py`, method copied from `evidence/30/dm1-input/connectivity.py`):

| source | → turnL | → turnR |
|---|---|---|
| odorExcL (10) | 59 edges, **+1712** | 8 edges, +163 |
| odorExcR (10) | 8 edges, +157 | 41 edges, **+1231** |
| odorInhL (6) | 4 edges, **−177** | 1 edge, −24 |
| odorInhR (6) | **0 edges** | 8 edges, **−269** |

Excitatory total 3263 vs inhibitory 470 — **6.9×**, independently confirming ATTRACT_VS_REPEL.md's asserted 3,385/497 ratio, which was previously an unverified agent report. The inhibitory side wiring is also *structurally asymmetric* (`odorInhR` has zero direct edges to `turnL`), which predicts exactly the observed inhibitory side asymmetry (−0.0043 vs +0.0118) that the excitatory arm does not show.

*Cause vs inference:* the weight ratio and the 14× behavioural collapse are measured. That warmup is what converts a 470-weight signal from detectable to null is **inference** — it is the only declared difference left after spacing, gain, geometry, speed and detection are eliminated.

**Smallest discriminating experiment:** run `evidence/30/cold-odor/probe.rs` unchanged except `Brain::seed_for_fly` followed by 60 `brain.step()` calls before the measurement loop. One knob, same 30 seeds, ~40 s. H1 predicts the inhibitory signed metric returns to ≈+0.008 and the excitatory arm barely moves. If inhibitory stays ≈+0.0006, warmup is not the mediator and H1 reduces to "the binding is simply too weak in any condition" — which is still actionable, and points at H2.

### H2 — The readout decodes membrane **voltage**, not spike rate, so an inhibitory drive and a strong excitatory drive are not sign-symmetric through it.

`lif.rs:307-315` averages `state.voltage`; `lif_sim.py:227-232` does the same. Faithful port, not a bug. But post-spike reset means a *more strongly driven* population reads *lower* voltage — `evidence/30/dm1-input/report.md` states this explicitly ("lower post-reset voltage must not be read as weaker firing") and its transmission check found DM1 PNs reliably increasing spiking while the turn groups' paired spike-fraction changes all span zero. The excitatory pathway drives its readout hard enough to be robust to this; a −470 hyperpolarizing input moves voltage in a regime where reset dynamics dominate. This is why "inhibitory decreases min distance" at 0.15 m (larger contrast, larger drive) need not survive at 0.4 mm contrast.

*Cause vs inference:* the decoder reading voltage is measured. The non-monotonicity claim is inference; `dm1-input/time-resolved/report.md` explicitly says neither decoder cancellation nor absence of direction is established.

**Smallest discriminating experiment:** re-summarize the *already banked* `dm1-input/transmission.json.gz` and `time-resolved` raw records — they contain both per-arm spike fractions and voltages for `turnL/turnR`. Compute the source-directed contrast in **spike fraction** where the voltage contrast is null. If the spike-rate contrast is signed and consistent where voltage is not, H2 is confirmed with zero new simulation.

### H3 — Production diverges from every accepted measurement on three axes at once.

- `apps/web/src/levels/open-window.ts:13` sets `flightSpeed: 0.24`; every accepted odor result was obtained at 0.12 (`chamber.rs:173`, `physical_sampling.rs:111`), and `evidence/03/review.md:11` attributes the *only* successful paired spatial result to translation being slow enough for neural response to affect trajectory.
- `sensory.rs:38-40` sums `attractive_odor + exit_cue` into the inhibitory channel. Every probe used `attractive_odor` alone (`physical_sampling.rs:39`; the odor fixtures set `exit: None`). Because the detector is categorical, the sum does not blend — whichever term is larger takes the side outright.
- `crates/game-wasm/src/attempt_session.rs:302-306` (`swarm_request`, called from `packages/sim-client/src/attempt-worker.ts:212`) wires **only** `ExcitatoryOdor` at gain 1.0. Any 20-fly count taken through that entry point has no attraction channel at all, unlike the authored levels which wire both at gain 2.

*Cause vs inference:* all three are directly quoted from source. Their behavioural cost is inference.

**Smallest discriminating experiment:** one run of `physical_sampling.rs` (`physical: true`, odor, 30 seeds) with `speed` changed 0.12 → 0.24 and nothing else. If the inhibitory signed metric degrades toward the cold value while excitatory holds, speed is a second independent amplifier of the same weakness. Separately, `grep` which entry point the current 20-fly batches use before trusting any escape count.

## 4. Corrections to prior claims

- **Refuted:** antenna spacing / 5%→0.01% contrast floor as the cause. Slice 27 measured at anatomical spacing with the adopted cutoff and got effects; the "0.01% passes on float noise, sides flip ~50% of ticks" story was asserted without a trace and is contradicted by 89 detected ticks/100 and by the excitatory arm's 96% reproduction through the same detector.
- **Refuted:** flight-readout dilution. `evidence/30/cold-odor/evidence.json` already records `meanFlightTurn`; excitatory +0.01568 vs `meanTurn` +0.01658 — the olfactory term survives `flight_turn = 0.5·steer + olf` (`lif.rs:359`) essentially intact.
- **Refuted (as a redundant proposal):** any new gain sweep. `gain-sweep.md` covers 0.5–3 with an observed plateau above 1.5.
- **Corrected:** ATTRACT_VS_REPEL.md's framing ("aversive graph activity is real; the turn does not listen") is right about the *asymmetry* and its 7× number now checks out — but in the current Rust the polarity is inverted, so the pathway the readout ignores is the one now carrying **attraction**. Its recommended Option A (extend `OLFACTORY_DN_*`) would, applied to today's code, be a change to the attraction path, not the repulsion path.

## 5. Bounds

No simulation was run. The graph-weight table is one-hop directed weight and, as `connectivity.py` itself notes, does not predict dynamics. The warm/cold comparison in §2 assumes the mirror/side conventions align between the two probes (`field_lab.rs:122` source at `(-2, -mirror)`; `probe.rs` source at `(-2, -side)` — they do), and that Chamber's 0.5 collision radius vs `physical_sampling`'s 0.0026 is inert over a 0.787 m path from x=−2 in a room reaching x=0 (no sweep contact is reachable, but this was not verified from traces). Even a full repair targets a distributional shift in 20-fly escapes, consistent with the user's stated bar; evidence/03 measured closest-approach shifts, never asymptotic target seeking.
