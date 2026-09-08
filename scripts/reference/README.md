# Neural reference evidence

The [generator](generate_lif.py) executes [`lif_sim.py:LIFSimulator`](lif_sim.py) with
injected noise and records its actual local intermediate arrays at return.
It does not implement a second neural model. The [JSON fixture](../../tests/reference/lif_synthetic.json)
is synthetic numerical evidence, never evidence of biological fidelity or
successful real-data extraction. Its source hash identifies the oracle exactly;
regeneration should be an intentional review when that source changes.

Run `python scripts/reference/generate_lif.py`, then
`python -m unittest discover -s tests/reference -v` in the repository's Python
environment. Generation needs the oracle's NumPy, SciPy and pandas dependencies.
The committed JSON remains usable without Python. The retained oracle implementations are offline evidence tools, not browser runtime consumers. The graph preparer independently checks its extraction against [`graph_loader.py`](graph_loader.py).

For the Rust consumer, each edge names a presynaptic source and postsynaptic
destination. Python stores source rows and uses the transpose during stepping;
the prepared Rust graph stores destination rows instead. Noise values are
already-scaled additive samples, so the consumer must not multiply them by
`noise_std` again. Body IDs remain decimal strings; absent IDs in injected
current are ignored, and each tick replaces the full current vector.

Compare all floating-point state, intermediate currents and voltage increments,
and motor outputs using the tolerances stored in the fixture. Compare spikes
and refractory counters exactly. Threshold equality is represented with exact
binary values to distinguish `>` from `>=`; other spike comparisons stay clear
of the threshold boundary. `dV` is the computed increment before refractory
masking; `can_spike` is the mask before the end-of-tick decrement.

Motor groups are explicit, noncontiguous and overlapping. The captured thrust
readouts, and the flight steering term, use membrane voltage after reset and
clamp. The olfactory turn term instead reads the same tick's spike fractions,
so one case deliberately makes the firing and voltage differences disagree in
sign or in which of them is zero; a voltage-based turn cannot reproduce it. The
input group lists are deliberately assigned directly: this fixture tests
neural/readout semantics, while graph extraction owns real group membership and
body-side annotation evidence.
