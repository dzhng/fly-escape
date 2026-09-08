# Reproducible conservative candidate

The offline exporter retains original supporting planes and edge incidence in
`assets/fly/contact-envelope-candidate.json`. It has one canonical array of 252
vertices, 128 planes and 378 edges; every edge references its vertices and two
incident planes. Runtime does not yet use it as the moving body.

The artifact records the GLB hash, exact source-hull byte hash, algorithm
provenance, native/candidate axis extrema, containment residual and outward
distance. All six extrema remain exact. Maximum measured outward distance is
9.259275 μm; native point containment residual is 3.81e-18 m. These are numerical
geometry results, not continuous animation or movement guarantees.

The original point-only candidate had 245 vertices. The canonical inventory
changes nearest point positions by at most 4.53e-16 m and sampled support values
by at most 2.61e-18 m. It retains the same physical envelope to numerical
precision. The earlier static browser comparisons remain attachment evidence;
this offline change does not alter game rendering or behavior.

## Boundary ownership and exact audit

The [rejected reconstruction](path-comparison/README.md) showed that Parry's
reported face topology can disagree with its point-support hull. Preparation
therefore retains its original supporting planes and obtains edges by clipping
plane-pair lines against all halfspaces. Plane-triplet identities share vertices;
coordinate proximity never merges distinct features. Near-zero positive edges
remain explicit. Parry still supplies point projections, not the final boundary
inventory.

The [plane inventory](plane-inventory/README.md) includes numerical validation
and an independently reviewed exact-integer construction. The
[serialized-unit audit](plane-inventory/serialized-exact-signs.json.gz) repeats
that construction for the actual saved metre offsets: it confirms every vertex's
plane incidence and every edge's endpoint incidence, with all 252 vertices and
378 edges present. Maximum saved-vertex discrepancy from exact coordinates is
1.52976e-13 mm. The artifact SHA-256 is retained in the audit.

Certification applies to these stored binary64 halfspaces, not arbitrary future
exports, pre-rounding construction planes, exact containment of the original
animated fly, or rotating movement. Unit conversion is audited because it can
round offsets. Numerical validation allowances never move a plane or add query
clearance.

## Integrated verification and review

Both [focused tests](boundary-test.log) pass: regenerated artifact equality,
source-point containment, exact extrema, outward target, invalid inward plane
rejection and nonincident edge rejection. [Release Clippy](boundary-clippy.log)
passes. The author verified byte-identical regeneration through the outermost
TypeScript exporter and confirmed deliberate validator falsification makes the
test fail before restoring it.

The parent reviewed line clipping, inequality signs, source hashes, normalized
units, axis-coordinate assignment, shared vertex identity, face-cycle validation
and bounded forward progress. The offline Rust example reuses the pinned Parry
library; the existing TypeScript exporter optionally invokes it. No dependency,
runtime branch, body setting or build-identity change was added. Asset docs remain
reachable from the root README. The boundary addition costs about 240 Rust lines
for construction, validation and behavioral tests; no second vertex array or
runtime geometry owner was retained.

Independent Codex CLI review remains unavailable because the installed client
rejects the configured model. Parent code review and the independent arithmetic
audit are the completed reviews, not a successful CLI review.

The next component is a bounded fixed-orientation path under the existing query
owner. Global competing contacts, continuous turns, body/replay behavior, WASM
and twenty-fly cost still decide final adoption.
