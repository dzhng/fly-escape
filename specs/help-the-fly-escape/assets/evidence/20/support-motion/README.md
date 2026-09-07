# Native supported-motion reproduction

Movement is not accepted. The sampled native hull can return a blocking hit during a horizontal translation across a flat triangle floor. Downward acquisition and upward departure still work in this reproduction; those earlier gates do not establish supported walking.

The probe uses the existing sampled hull from `../contact-shape/sampled-hull.json.gz`, the authored apple, and the production `ContactScene`. `results.jsonl` starts at each cast-derived landing root. `exact-floor.jsonl` additionally sets the floor root to the negative minimum hull vertex height, removing landing-root error as the sole explanation. Both report false floor obstructions. For example, at the central floor sample a requested 1mm horizontal move reports contact after roughly 60nm even at the exact floor root. Apple horizontal collisions may be legitimate uphill contact; they are not classified as query failures here.

To reproduce, make a temporary Cargo binary depending on this repository's `sim` crate and `serde_json`, use `probe.rs` as its main, and pass the decompressed hull JSON and `assets/food/apple/contact.json` paths. Add `--exact-floor` for the second run. No production schema, controller or clearance changes were made by this probe.

Resolve supported translation and changing orientation before adopting the hull. Do not blindly discard tangential hits from an entire mesh: a later face can block the same move. An analytic floor constraint or a robust surface solver remain alternatives to measure, not decisions already adopted. The existing kernel's acquisition/departure acceptance remains scoped to its tested contract.
