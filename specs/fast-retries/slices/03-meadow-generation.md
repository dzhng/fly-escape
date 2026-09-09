# Bound the cost of returning to the meadow

## Contract and measured cause

The completed-round return must meet the existing 500 ms action-to-editable-frame limit. A complete real-time level-1 round returned in 548 ms. The follow-up [CPU trace](../assets/regression/completed-return-profile.json) attributes about 168 ms of a 364 ms click task to terrain height queries, with further grass generation and shader work. Setup and playback require different conservative meadow footprints, so retaining the world alone does not avoid that rebuild.

Keep the existing footprint, grass sampling, scenery density and camera rules. This first pass does not add a meadow cache or hide delayed work behind a premature ready state. The later view-coverage slice addresses the separately measured relative-latency failure. Compute the distance to the nearest room/wall rectangle by minimizing squared distances and taking one square root at the end. This replaces one square-root operation per rectangle with one per point. Only renderer terrain arithmetic changes; the simulation, neural inputs and recorded motion remain untouched.

## Verification

Preserve complete generated geometry hashes before the change for actual campaign masks across close and broad footprints. Afterward, compare all numeric geometry attributes and instance transforms, clump counts and resource counts. Report any floating-point difference rather than assuming algebra implies identical output. Existing terrain, room-mask and camera-coverage tests remain required.

Then measure the actual completed-return path, with the same DOM click timing and paint boundary. It must meet the unchanged limit. Rerun both complete real-time campaign rounds and final paired seeds, and inspect normal setup/playback/returned images against their original frames with an unprimed visual reviewer. If arithmetic alone does not provide sufficient margin, profile the remaining work and reslice that cause before adding another mechanism.
