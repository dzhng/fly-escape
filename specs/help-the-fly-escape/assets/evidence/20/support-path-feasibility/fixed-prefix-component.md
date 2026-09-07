# Fixed-orientation prefix component

This native-only component uses the prepared original-plane boundary under the
existing ContactHull/ContactScene owners. It preserves the caller's validated
start root, emits a supported prefix, and stops at gaps, height discontinuities
or other food. The shared boundary validator also serves the offline exporter;
regeneration preserves the candidate bytes. Body and replay do not consume it.

[Measured construction results](fixed-prefix-component-results.json) cover four
fixed poses over the same 6mm authored-apple path. Scene and hull preparation are
outside timing. Identical affine spans merge across irrelevant knots; different spans must
pass the positional join check. This retains 7–29 segments; short intervals
cannot hide a geometric kink. Work/storage limits bound this experiment,
not a production update frequency. Neither rotating paths nor 20/100-fly browser
performance are accepted by these measurements.

Consumer tests compare segment samples with independent core support queries and
static native-hull contact. Separate regressions cover gaps, higher branches,
other-food blocking, a wholly enclosed start, invalid input and budget exhaustion.
Exact-zero wall contact emits an empty prefix; a roundoff-sized positive impact
interval stays positive. Future body consumers must enforce forward progress.
The interval coverage regression preserves a gap between adjacent floating-point
knots. Closed food must be a single outward, edge-connected component; mixed
closed/open components and nonmanifold edges are rejected, without repairing
source geometry or interpreting arbitrary open patches as volumes.

The default release tests, changed-target release Clippy and exporter tests pass.
All-target Clippy additionally reports the existing unrelated argument-count
lint in physical_sampling.rs. Independent review found and verified fixes for
short-interval merging, zero-width output, mixed-component containment and
rounded-midpoint gap coverage. The final endpoint is independently checked;
a mismatch stops as Discontinuity while retaining the reached root.
