# Brain panel background

The user requested the game palette rather than the reference image's dark background. The canvas is transparent so the panel owns its background color. Fixed CSS canvas dimensions keep renderer buffer resizing from changing the observed host layout; WebKit's resize-observer loop warning disappears with the same smoke test (two page errors before, none after).

Production-route captures retain identical316×315 card dimensions;64,292 of99,540pixels changed. The brain geometry and recorded activity mapping are unchanged. An independent visual reviewer found a distinct silhouette, visible magenta/cyan/purple activity and no clipping or panel integration defect. Sparse green/yellow/red points remain harder to distinguish at native size; no claim of equally prominent individual groups is made.

TypeScript and web build pass. WebKit26.6 passes setup/model readiness, twenty-fly playback, pause and seeking, cancellation, and a fresh retry. This is engine smoke coverage, not actual Safari acceptance or a full campaign.
