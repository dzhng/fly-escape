# Exterior grass preparation

Prepared on `056da32` in an isolated worktree. This pass adds only exterior
appearance and its coordinated normal-camera zoom cap. It does not accept
natural household materials, lighting, campaign composition or close-range grass
realism. [The slice](../../../../slices/22-house-surfaces.md#exterior-ownership-and-range-decision)
owns the range and ownership decision.

## Evidence and review

`before/` is the production build with the original camera and the exterior
render call temporarily omitted in the isolated worktree. That counterfactual
was restored before the candidate build; there is no persisted debug switch.
`production/` runs the actual `/` setup and playback route, fixing only its seed
source to 42. The unchanged worker records twenty real connectome flies.
`lab/` uses the existing proportions fixture and actual recorded bodies.
Full frames precede corresponding crops; `rejected/` retains the square turf,
sparse blade trial and wall-edge hairline.

A reviewer with previous house/motion context but no grass-image history inspected
all five lab fulls/crops and three production fulls/crops. Ordinary views read as
continuous lawn, with clear house floors and legible controls/fly selection.
Extreme close blades remain angular flat ribbons over a mottled base; this is an
open realism gate, not hidden by the acceptable room-scale view. Exterior
fly-on-grass camouflage/occlusion remains unproved. The reviewer separately
confirmed removal of the pale wall-edge hairline in a full/crop follow-up, with
no new visible gap or intrusion. Final wide and portrait production views were
self-reviewed, not an additional independent first look. House lighting/contact
shadow quality and existing interior white trails are outside this pass.

## Bounds and cost

The existing camera owns circular ground coverage across normal allowed targets,
zoom and aspect. Grass never enlarges house-fit bounds. The production canvas
1075×625 changes from a 65 m conservative field radius to 38 m; the wide
2195×525 witness changes 123→67.5 m and portrait 600×637 changes 56→33.5 m.
The centred full-house Overview distance is unchanged. Edge-follow maximum zoom
is now capped at that distance, with the selected fly still centred. Numerical
coverage tests include viewport ground corners and the far clip. The diagnostic
low mounting view is explicitly outside the normal-angle coverage guarantee.

One uniformly sampled field uses static spatial batches and normal frustum
culling. There is no LOD or streaming. Local `~/dev/game` blade-field code informed
the packed-record and instanced-geometry approach; this is original small Three
WebGL geometry/shader code, without importing the battle renderer. Physical art
assumptions are 42–98 mm blade height and 6–10 mm maximum blade width, with
curvature and deterministic colour/scale variation. The record cap bounds memory
but increases spacing on very large/wide fields: about 74 mm in the production
normal view and 132 mm in the wide witness. Wide close-density is therefore an
explicit remaining realism limit.

`radius-comparison.json`, the per-surface reports and `pixel-metrics.json` retain
measurements. The room fixture reaches ~55 mm spacing with ~7.74 MB packed
records. Production uses at most ~32 MB packed records. At the standard production
viewport, the bounded run reports approximately 0.44M submitted triangles in
follow and 6.22M in Overview, with 23 textures. Median RAF intervals remain about
16.7 ms in these short runs; these are not a hardware-independent FPS guarantee.
House and lighting inputs are frozen. Production follow pixels match the
counterfactual exactly; 53,731 eroded room pixels in Overview have zero channel
differences above five, while 88.58% of the full canvas changes in the exterior.

## Verification and limits

The browser harnesses are [production](../../../../../../tests/browser/exterior-production.mjs)
and [existing lab](../../../../../../tests/browser/exterior-grass.mjs).
Production pause and 20→10→20 reverse restoration compare exact PNG bytes.
Wide→portrait→original resize also restores exact bytes. Resize resource reports
and renderer tests cover batch replacement and shared resource disposal. The
stable exterior render order prevents material allocation order from changing
antialiased wall-edge pixels during rebuilds. Turf extends invisibly beneath
walls; blade exclusion still covers wall thickness and joins.

A failed experimental resize assertion exposed a harness bounded-work defect:
Node's deep Buffer diff attempted enormous diagnostic work for just three changed
pixels, accompanied by memory/swap pressure. Image assertions now compare
`Buffer.equals` and print hashes only, preserving exactness. The three-pixel
render-order defect was fixed rather than tolerated or repinned.

Typecheck, both production builds and 41 renderer tests pass. The independent
Codex CLI review could not run: the installed CLI rejects its configured model
as requiring a newer version (`cli-review.txt`). Manual source review covers
single ownership, shader coordinates, mask joins, culling bounds, resource
replacement and camera range semantics. Root integration/Preview review remains
separate from this prepared checkpoint.
