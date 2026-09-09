# Input-only v3 proposal

**Not approved for Brain execution. No v3 seeds are selected or frozen.** The
[v2 results](../results.md) remain the completed evidence: panel 08 failed its
voltage criterion and panel 09 passed. This proposal does not change those
results or the passed color panel.

The proposed change doubles each geometric patch from 32 to 64 joint-supported
samples using the same anchors, squared image-plane distance ordering, and sample
index tie-break. Every original sample remains in its enlarged patch. The upper
and lower sets remain disjoint within each eye, so the expansion is feasible
without moving the stimulus toward a favorable neural response. Every sample
retains RGB8 gray128 against black.

The floor pair uses the separately declared
[physical doorway design](../floor-v3/README.md) and its
[complete capture montage](../floor-v3/inputs.png). Its closer fixed pose and
doorway-filling blocker change 384 compound samples. The flight pair and every
other panel 08 input remain byte-identical. All nine primary contrasts retain
their names and ordering.

The unchanged native adapter confirms these input currents:

| Patch | Stimulated inputs | Delivered current sum |
|---|---:|---:|
| Lupper | 54 | 32.0626223092 |
| Llower | 72 | 32.0626223092 |
| Rupper | 85 | 32.0626223092 |
| Rlower | 98 | 32.0626223092 |

All four patch contrasts have current L1 difference 64.1252446184. The new floor
pair changes 95 injected cells with L1 difference 17.2871128081, compared with
57 cells and 12.7450779385 for v2. Greater current coverage establishes input
feasibility only; it does not establish a neural response or predict a pass.

All eleven exact-current and dose controls pass. Requested and delivered
currents are finite, nonnegative, and within the existing per-cell and total
bounds. Chromatic-off conditions deliver zero Tm20 current. The complete values
and bindings live in [the input evidence](evidence.json), with raw adapter output
in [currents.json](currents.json).

[The proposal](proposal.json) retains the fixed gain, LIF parameters, voltage
primary outcome, 438 endpoints, input/motor exclusions, all nine contrast names,
and the existing simultaneous correction across 7,884 comparisons. It binds the
new RGB, geometry, floor capture, map, source identities, and v2 freezes.
Panel 09 has an empty *oracle batch* solely because no color input is being
re-evaluated; that batch is not a proposed replacement experiment.

[Preparation](prepare.py) builds only input bytes and metadata.
[Verification](verify.py) checks the unchanged native adapter output and prior
freeze invariants without reading neural reports. Neither step creates a Brain
instance or advances neural time. A new preregistration and separate run
clearance remain required before any v3 confirmation experiment.
