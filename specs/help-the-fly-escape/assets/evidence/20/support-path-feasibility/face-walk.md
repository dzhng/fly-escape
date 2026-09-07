# Bounded retained-face walk

**Verdict: local analytic progress demonstrated; global motion remains red.**
[Numeric results](walk-results.json.gz) retain every emitted segment and stop
condition. Source remains `/tmp/fly-rotation-probe/src/bin/walk.rs`.

The walk applies the [analytic domain solver](domain-events.md) to each active
triangle-face/hull-vertex feature. At a vertex-cone exit it selects the outgoing
adjacent vertex, checks root-height agreement at the event, and builds the next
constraint set. If that vertex is already outside the triangle, it stops before
installing it. Triangle barycentric exits stop the walk for another feature owner.
No edge/edge implementation is included here.

The experiment limits each walk to 256 segments and uses the fixed root-isolation
work schedule. It explicitly rejects repeated zero-time events rather than
advancing time by an artificial step. All recorded segments advance by more than
1e-12 normalized time; the fixtures require no repeated zero-time handoffs.
Near-coincident roots use that numerical time separation, so ambiguous ties still
need a robust production policy. Opposite signs are compared directly rather
than multiplying margins, avoiding underflow in crossing detection. No clearance
or geometry displacement is introduced.

| Fixture | Segments | Stop | Reference height agreement |
| --- | ---: | --- | ---: |
| Turn | 21 | Triangle edge | 1.55e-12 m |
| Tilt | 26 | Outgoing vertex outside triangle | **Global failure**, up to 7.24e-7 m |
| Combined turn/tilt/translation | 2 | Triangle edge | 6.30e-13 m |
| Constant pose | 1 | End of interval | Exact in this run |
| 6 mm translation | 1 | Triangle edge | 3.89e-14 m |

Each path is compared against 2,001 reference support queries over the emitted
range. Those checks test the analytic trajectory and state handoffs; they are not
a continuous global competitor certificate. Root-height gaps at accepted vertex
handoffs are at most 2.85e-17 m. Local solve times are approximately 8–268 μs in
this native run, excluding the reference checks and geometry preparation. The
turn uses 6,687 scalar evaluations; the tilt uses 7,941. These are local planning
cost observations, not browser or complete movement performance claims.

The pure-turn outgoing event is concrete: normalized fraction
`0.4768618445590044`, heading `0.7152927668385065` rad, root
`[20,75.33935983619311,-3]` mm. Triangle 201's edge `[122,82]` is reached with
reconstructed hull vertex 1312. This supplies the entry state for the separate
hull-edge `[1084,1312]` / triangle-edge probe.

The tilt is deliberately unaccepted. At fraction `0.6493316594983932`, vertex 119
would hand off to vertex 46, whose triangle barycentric margin is already
`-0.05337890724352895`. The walk stops before assigning that invalid local feature.
A neighboring-triangle competitor overtakes it earlier (first sampled failure at
fraction about `0.649007`), so even the locally valid prefix is not globally
accepted through its endpoint. Domain ownership must be combined with competitor
events, not treated as proof of nonpenetration.

The translation-only first boundary at fraction `0.33492689059563807` matches the
first breakpoint of the exact fixed-orientation envelope oracle. Next work is
outgoing feature and global competitor events; the successful local walk does not
close acquisition, support loss, general translating rotation or replay gates.
