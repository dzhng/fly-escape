# Revised trails — body patches resolved in capture, contrast gate open

Production candidate `c4e7b29` was built in the isolated proof worktree and run on its own port5208. The unchanged browser harness repeated all eight actual setup states from the [rejected checkpoint](../browser/review.md): seed42, 20flies, no placements, ticks10.3/30.5/60.5/100.5, close and Overview. All eight camera records equal the prior capture exactly. Reports preserve simulation/graph/build identities. Full-frame progress text differs; world comparison bounds stay fixed.

The reviewer did not implement trails but has now seen the prior candidate and root's proposed correction. This is a contextual independent-of-author re-review, **not an unprimed first look**. Inspection covered all eight full frames, corresponding world comparisons and every tight baseline/candidate pair. The two later tick200.5 full frames were also inspected.

**Verdict: revised candidate is less wrong than the first candidate, but the complete visual gate remains open.** The bright rectangular patch over the selected abdomen at tick100.5 is absent. Fine tracks still cross some other bodies at tick60.5 without the broad white patches. Close tracks are much thinner and less obstructive, but often extremely faint against the pale floor. Overview does not visibly communicate individual recent paths at ordinary display size. At tick10.3 the gap removes all visible history: the world is pixel-identical to the no-trail baseline. At later tick200.5 all20flies are still active, with faint close paths and weak Overview contrast; insufficient time/history therefore is not the only cause. No new geometry/UI defect is evident. Stills cannot prove absence of brief moving pops.

Exact canvas equality after pause and forward/reverse seek passes for all eight comparison states and both later states; browser errors are empty. The unchanged rendering path updates width after the current camera's tracking/input update, including while paused. Focused trail tests pass4/22 assertions and typecheck passes.

## Measurements

`comparison` compares the rejected trail candidate to this revision. `coverage.json` and `tight` compare the original **no-trail** counterfactual to this revision, using the already captured matching baseline. Tight pairs are baseline left/revision right, increasing cursor downwards. All world comparisons use564,375pixels. No counterfactual source edit was needed in this pass.

| Cursor | Revised close changed pixels | Close ΔRGB>16 | Revised Overview changed pixels | Overview ΔRGB>16 |
|---|---:|---:|---:|---:|
|10.3|0|0|0|0|
|30.5|7,097|1,415|530|123|
|60.5|10,571|2,156|491|122|
|100.5|5,284|568|468|139|

Within the selected close crop, baseline-dark pixels affected by >16RGB drop586→1 at tick100.5 and2533→437 at tick60.5. This supports reduced body interference but is only a dark-pixel proxy, not a full fly mask. Overview pixels above16RGB increase from11→123 at30.5,48→122 at60.5 and53→139 at100.5; despite the increase, the tracks remain hard to follow visually.

`projection-check.json` reconstructs reported Overview cameras and estimates the .08world cap's projected width at fly-region planes over24directions:1.29–2.11CSSpixels. The1.5pixel target may be mildly capped in some directions, but these measurements **do not support subpixel width as the main cause**. White-on-pale contrast remains the stronger visible issue. Floor/palette changes are outside this09checkpoint; acceptance should be revisited with the shared11lighting/palette integration rather than declaring Overview complete now.

## Source review

No correctness blocker found in the width/gap change. Fixed buffers, age clipping, recorded cursor ownership and camera-before-width ordering remain clear. Two limits deserve precise language: the head gap excludes recent **path length**, not every geometric point inside a fly footprint (a loop or another fly's path may still cross a body); and constant projected width is approximate per segment with explicit world-width clamps. The current straight-line unit test verifies the intended gap endpoint but does not establish universal body masking. These are limitations of the stated visual approach, not reasons to change simulation paths. No product source was changed by this review.
