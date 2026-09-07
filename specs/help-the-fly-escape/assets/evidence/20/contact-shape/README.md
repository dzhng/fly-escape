# Native contact-shape candidate

This is measurement evidence, not the adopted fly collision shape. The extractor runs from the repo root using Bun and reads the native GLB. It takes convex hulls of101 poses per clip and combines them; the result is finite-sample evidence, not a proof covering every animation phase.

The candidate has1834 vertices. A fixed upright envelope landed on an analytic80mm apple leaves the resting visible vertices20–166µm from the surface across the five sampled positions. Aligning the native support pivot and up direction with the sphere surface reduces the nearest resting-vertex gap to19.7µm in each case. These are vertex-distance measurements, not a complete contact or rendered-appearance verdict. They show why height alone is insufficient and motivate recording the support normal.

`sampled-hull.json.gz` preserves the source asset hash, points and phase bounds. `contact-comparison.json` contains the measured positions, normals and gaps. The source archive reproduces the native geometric comparison; it is separate from the production kernel tests. No camera, animation, body or neuroscience behavior changed during extraction.

Next: inspect an actual browser close-up with the native model attached to a surface point/normal, then adopt or replace this shape before wiring food contact. The remaining19.7µm vertex gap and unsupported intermediate animation phases must not be waved through as proven physical contact.
