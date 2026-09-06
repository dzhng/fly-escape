# Implementation choices

## Sound — medium confidence

### Injected noise is already scaled (slice 01)

When a reference tick contains a noise value, the Rust port must add that value directly to its voltage equation. Multiplying it by the noise setting again would make the same test represent a different input. The plan required injected noise but did not specify its representation. This choice makes the fixture portable and constrains the future test reader, not production random-number generation.

### Tiny-fixture float tolerance is 1e-12 (slice 01)

Python and Rust can round an arithmetic operation slightly differently. The four-neuron reference therefore accepts absolute or relative differences up to 1e-12 for floating values, while spikes and countdowns must match exactly. The plan required stated tolerances without selecting them. This tight numerical check is sound for these small fixtures; it is not a claim that large noisy simulations remain identical forever.

### One-fly transport uses generated JSON before packed swarm records (slice 02)

The lab requests one neural tick and receives a small JSON frame whose type comes from Rust. This makes the first real browser checkpoint inspectable without inventing the whole swarm archive at once. The plan did not specify the intermediate transport encoding. It is a temporary, bounded one-fly seam; slice 05 replaces its per-tick JSON transfer with packed chunk buffers while retaining the same authoritative simulation and playback data.

### Lab movement is a bounded observation fixture (slice 02)

The first fly moves on a twelve-unit square from its neural thrust and turn. A wall stops penetration without choosing a new direction. This gives us an observable brain before sensory fields and body mechanics are ready; it is not a substitute for the final locomotion model. The plan requested a chamber without fixing its movement scale. The dimensions are exported by the core, and slice 03 replaces the chamber-only geometry path with the general environment owner.

### Browser smoke tests use installed Chrome (slice 02)

The browser checks launch the locally installed Chrome through Playwright, so the evidence names an actual desktop browser. Playwright's newly installed default Chromium binary was absent. The test exposes a browser-channel setting rather than silently downloading a different browser or calling the missing executable a passed test. Firefox/Safari release coverage is still required later.

## Sound — high confidence

### Read intermediate values from the running Python oracle (slice 01)

The fixture generator observes local values when the real `step` function returns. It records the currents and voltage increments that function actually calculated, rather than maintaining a second copy of its equations. The plan required a trustworthy oracle but left observation mechanics open. Regeneration depends on those Python variable names; the saved fixture and future Rust tests do not.

### Assign synthetic motor groups directly (slice 01)

A test neuron may belong to two motor groups so the fixture can detect incorrect averaging. These memberships are explicit test inputs, not claims about fly anatomy. The plan did not prescribe how a miniature graph would obtain memberships. Separating arithmetic tests from real annotation extraction lets both fail for useful, distinct reasons.

## Sound — medium confidence (sensory/body integration)

### Stimulation excludes neurons read directly as movement (slice 03)

When a smell population overlaps a neuron whose voltage directly controls movement, the sensory adapter leaves that neuron unstimulated. The signal must reach the movement readout through the network. The plan required graph-driven behavior but did not define overlap handling. This avoids mistaking a direct motor injection for a circuit response; future sensory mappings inherit the same exclusion. Paired probes show the downstream response persists.

### Body actions begin with spikes and can last between spikes (slice 04)

A fly touching food starts a meal when enough proboscis motor neurons emit a spike. It then keeps eating during brief gaps between spikes, until contact, fullness or the bout limit ends the meal. The plan required neural initiation but left the signal decoder unspecified. A voltage threshold was nearly always active and could not distinguish initiation. Spike initiation preserves a neural cause without requiring every cell to fire continuously; silencing those neurons prevents every tested meal. Landing similarly enforces a short grounded interval before takeoff is possible again.

### An attempt error ends that attempt (shared Attempt preparation)

If advancing one fly fails after another fly has already advanced, retrying the tick would give them different histories. The Attempt owner remembers the failure and returns it on subsequent calls; the user can start a fresh attempt. The plan did not define partial-tick recovery. This keeps errors explicit without copying every brain on every tick for rollback. Future transport must present the error and must not retry the same attempt silently.

## Sound — high confidence (sensory/body integration)

### Replay identity includes the whole simulation source tree (shared Attempt preparation)

A saved attempt carries a build identity computed from simulation source, dependencies and compiler/target information. Adding a new Rust module changes that identity even if someone forgets to list it manually. The plan required reproducible identities but left build fingerprinting mechanics unspecified. Future replay can reject a different simulation instead of presenting different results as the same run.

### Field overlays show the actual sampled grid (slice 03)

When a fly senses odor in a grid cell, the colored floor comes from that same cell value exported by Rust. JavaScript does not draw a separate smooth approximation. The plan required agreement but left interpolation unspecified. This makes abrupt cell boundaries honest and lets numeric antenna samples explain what the brain actually received; future visual smoothing must not change the simulation.

## Sound — medium confidence (lifecycle and records)

### A selected seed demonstrates the full lifecycle (slice 04)

The lifecycle lab opens a seed that actually lands, starts eating through neural spikes, leaves food and later starves. A bounded ten-seed check found one such demonstration; the screen says that the seed was selected. The plan required a short review surface without prescribing how to ensure the sequence is visible. This is a reproducible example, not a claim that a typical fly finds food. Population feeding and campaign robustness still require their own tests.

### Eight event slots bound each fly’s tick (slice 05 preparation)

A fly can land, begin and end a meal, and reach a terminal outcome during the same tick. The compact record budgets eight events per fly per tick, above the six-transition combination exercised by the current body. If a future behavior exceeds that count, encoding fails explicitly until the bound is reconsidered. The plan required memory to include events but left their maximum representation open. This keeps the archive estimate honest without allocating unbounded event history.

## Sound — high confidence (records)

### Replay retains the original numeric precision and absent samples (slice 05 preparation)

A recorded neural voltage stays a 64-bit floating-point value, rather than being rounded for transfer. Once a fly is terminal, its absent neural/sensory samples remain absent through explicit presence flags; zeros would falsely look like measured inactivity. The plan required consistent replay without choosing the numeric encoding. The complete 20-fly horizon fits the archive limit with this precision, so compression does not need to change the observations.
