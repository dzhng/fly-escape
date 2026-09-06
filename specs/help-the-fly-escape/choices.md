# Implementation choices

## Sound — medium confidence

### Injected noise is already scaled (slice 01)

When a reference tick contains a noise value, the Rust port must add that value directly to its voltage equation. Multiplying it by the noise setting again would make the same test represent a different input. The plan required injected noise but did not specify its representation. This choice makes the fixture portable and constrains the future test reader, not production random-number generation.

### Tiny-fixture float tolerance is 1e-12 (slice 01)

Python and Rust can round an arithmetic operation slightly differently. The four-neuron reference therefore accepts absolute or relative differences up to 1e-12 for floating values, while spikes and countdowns must match exactly. The plan required stated tolerances without selecting them. This tight numerical check is sound for these small fixtures; it is not a claim that large noisy simulations remain identical forever.

## Sound — high confidence

### Read intermediate values from the running Python oracle (slice 01)

The fixture generator observes local values when the real `step` function returns. It records the currents and voltage increments that function actually calculated, rather than maintaining a second copy of its equations. The plan required a trustworthy oracle but left observation mechanics open. Regeneration depends on those Python variable names; the saved fixture and future Rust tests do not.

### Assign synthetic motor groups directly (slice 01)

A test neuron may belong to two motor groups so the fixture can detect incorrect averaging. These memberships are explicit test inputs, not claims about fly anatomy. The plan did not prescribe how a miniature graph would obtain memberships. Separating arithmetic tests from real annotation extraction lets both fail for useful, distinct reasons.
