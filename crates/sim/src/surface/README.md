# Contact query ownership

The immutable scene owns mesh acceleration once for all callers. Prepared hull
incidence and its point-support query shape belong to `ContactHull`; the same
boundary validator serves the offline exporter. Reconstructing a convex point
cloud does not establish trustworthy face/edge identity. Point-only hulls remain
valid for casts and support samples, but cannot request a support path.

`fixed_support_path` returns a prefix under one fixed orientation and one food
identity. It validates the supplied root against the existing support-query
precision and preserves that root, rather than lifting onto another branch.
The upper boundary of triangle-minus-hull obstacles gives linear support spans;
only the connected prefix is returned. A gap, discontinuous height, or blocking
neighbor ends it. Other food never becomes support implicitly. Initial overlap
is checked separately because a separating cast may allow departure from an
already-penetrating start. Scene preparation classifies closed meshes by paired
edges and validates consistent outward winding. A surface containing a closed
component must be that single food boundary; mixed open/closed components and
nonmanifold edges are rejected. Disconnected open patches remain valid. Only closed meshes use solid
interior checks. Open patches retain surface-only semantics. A hull's vertex mean
provides an interior point for detecting complete containment in closed food.

The caller supplies work and storage budgets. Charged work includes triangle
visits, plane/clipping work, pair comparisons, envelope selection and conservative
triangle-count charges before existing kernel calls. Storage counts live logical
items in temporary arrays and output segments, with checks before growth; allocator
capacity growth is additional bounded overhead. Polygon storage follows clipping
work rather than an independent tuning constant. Exhaustion returns counters and
an error, never a partial result presented as complete. These limits are experiment
inputs, not campaign constants or a wall-clock guarantee.

A stop at the current fraction emits no zero-duration segment. Segment merging
checks positional deviation at the original join, including very short intervals;
a small duration must not hide a geometric corner. Coverage must contain the whole
knot interval, even when its midpoint rounds onto an endpoint. A final independent
support query reports an endpoint branch mismatch as a discontinuity, retaining
the reached root. Positive roundoff-sized intervals remain positive; future body
consumers must enforce forward progress instead of repeatedly reacquiring a
zero-time or tiny-distance stop.

Returned roots are in metres; normalization stays internal. Callers can interpolate
each linear segment directly using its fraction interval and shared quaternion.
They must not interpolate across a stop, change orientation during a segment, or
reinterpret this component as acquisition/feeding/body permission. Existing body,
record and playback behavior remains unchanged pending rotating-path acceptance.

[Consumer tests](../../tests/support_path.rs) exercise authored contact, disconnected
support, height branches, neighboring food and exhaustion through the scene query.
