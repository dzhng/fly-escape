# Reproducible conservative candidate

The offline exporter now reproduces the reviewed 128-plane candidate through the
existing fly-asset preparation command. The derivative lives at
`assets/fly/contact-envelope-candidate.json`; runtime still uses neither this
candidate nor the full animation hull as its moving body.

The artifact records the GLB hash, exact source-hull byte hash, algorithm
provenance, native/candidate axis extrema, containment residual and outward
distance. Its 245 vertices match the banked comparison candidate exactly. The
maximum measured outward distance is 9.259275 μm; containment residual is
3.487e-18 m. These are numerical geometry results, not continuous animation or
movement guarantees.

## Integration review

The Rust example owns the offline supporting-plane construction and reuses the
simulator's pinned Parry dependency. The existing TypeScript exporter supplies
the full animation hull and optionally invokes this derivative step. No runtime
branch, query clearance, dependency, body setting or build-identity change was
added. The source remains separate from its candidate.

The parent review checked polar inversion, exact incident axis coordinates,
source hashes, bounded refinement, units and consumer isolation. The added
surface is one offline example, one optional preparation output and one asset;
the generator includes its focused geometry test. Asset documentation remains
reachable from the root README. No duplicate runtime geometry owner was found.

The integrated [focused test](preparation-test.log) passes, including regenerated artifact equality,
source-point containment, exact extrema and the sub-10-μm outward target.
The outermost [export command](preparation-export.log) also regenerated both the full hull and derivative byte-identically on the integrated tree. The author confirmed deliberate inward shrink fails the containment check,
and ran clean formatting checks. Integrated [release Clippy](preparation-clippy.log) also passes. Independent Codex CLI review could not
run because the installed client rejects the configured model; this is a parent
code review, not a successful independent CLI review.

The fixed plane budget is a reviewed preparation target. Movement, continuous
replay, WASM and twenty-fly cost still decide adoption. The numerical rejection
allowance never moves the shape or becomes a physical clearance.

## Follow-up topology finding

The first fixed-orientation movement comparison exposed an additional limit:
Parry's reconstructed candidate face topology is not a valid supporting boundary.
A reported face excludes another candidate point by 3.27 mm. The constructor
does not run its own `check_geometry` assertion. Its edge array also retains
deleted internal diagonals; boundary incidence must select active edges.

This does not invalidate the point-set support-map measurements above:
`PointQuery::project_local_point` uses GJK support points, and the core downward
casts still return support. It does invalidate using the candidate's reconstructed
face witnesses or adjacency as an exact path oracle. Fixed-path comparison must
resolve and validate its feature inventory before it can establish correctness
or useful movement cost. Projecting every plane's offset over all points removes
invalid halfspaces, but does not alone prove the direction inventory is complete.
