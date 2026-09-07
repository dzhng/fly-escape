# 14 — Editable setup and attempt loop

Status: editor, attempt loop and six-tool art integrated; root readiness and human checkpoint pending. Dependencies: 05,06,10,13.

## Contract and seam

Players can place a fixed inventory, run, inspect results and retry with their setup intact.

web attempt state machine + sim placement validation/AttemptSpec → Worker; result → local progress store.

## Integrated ownership and remaining gate

The core owns simultaneous odor/vision inputs, wall-aware transport and fan wind, placement validation, inventory and immutable attempt inputs. The web editor uses that seam for atomic edits and the run/result/retry lifecycle. [Mixed-sensory evidence](../assets/evidence/14/mixed-sensory.md), [placement evidence](../assets/evidence/14/placement.md) and [setup integration](../assets/evidence/14/setup/integrated/review.md) preserve the component and browser results. [Integrated performance](../assets/evidence/14/integrated-performance/review.md) is tied to its measured build, not final release.

All six catalog tools now use authored assets through one placement-model owner. [Food evidence](../assets/evidence/14/food-integrated/review.md) and [remaining-tool evidence](../assets/evidence/14/tools/review.md) retain rejected candidates, replacements and independent final full-frame/crop reviews. Root integration readiness/failure/delay coverage and the human shot checkpoint remain before slice acceptance. Campaign usefulness and difficulty are separate gates in 15–16.

## Runnable review surface

A five-room integration fixture with palette, valid/invalid placement, fan rotation, Run, cancel, result, replay and Retry.

## Verification

Place/move/remove consumes/refunds correctly. Core rejects invalid geometry without consuming items. Run freezes setup; retry edits old placements but next Run has fresh seed. Replay does not create another result. Reload retains best stars/preferences/setup; unfinished attempt ends. Storage failure leaves session playable.

Visual variable and crop: Placement feedback clarity; toolbar, placement ghost and error/result crops. Final level difficulty and decorative art are out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) for the named reference/prior look, recording telemetry and a less-wrong verdict rather than exact pixel matching. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) on all candidate captures and tight crops as the **last visual check before acceptance**. Fix actionable findings and repeat that final check.

Human checkpoint is non-blocking: open shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes for feedback while continuing independent work, then decide from evidence if silent. Record the decision/rationale and close the opened shots. Silence is not approval for new scope.

## Decision budget

Delegated: Control spacing/icons and error wording; retain no shop, no tutorial modal, no mid-run edits.

Human feedback that changes this slice: Placement friction can change reversible controls; scoring/seed semantics remain fixed.

Must stay green: all accepted dependency contracts and their focused fixtures; neural motor ownership, real-data provenance, bounded work and the [global invariants](../README.md#standing-gates-and-ownership). Do not broaden testing without a new failure or changed consumer. Record evidence under `assets/evidence/14/` and update the README handoff before ending the pass. Unlisted material decisions require a spec update.

## Presentation contract

The authoritative catalog owns placement and contact footprints; renderer transforms consume placement centre and heading. Static, non-solid floor assets retain near-flush relief at or below 0.005 world units. They add no collider, movement height, light source, heading correction or field computation. Fruit provides edible contact; crumbs provide scent without food. Body-circle food contact may begin beyond the drawn footprint: verify recognizable food and grounded attached feeding, without promising literal mouth intersection or changing physics to conceal the boundary.

Vinegar is a shallow liquid saucer, fan a recessed rotor/grille with a direction mark, lamp a square pale-lens fixture, and shade a dark slatted cue tile. Shade marks a source; it is not a simulated canopy. Tool appearance does not establish a biological effect. Preserve separate Blender sources, static bounds, catalog scaling, ghost/replacement disposal, fan heading and paused/reverse identity.

Required house, placement models and fly share setup readiness before Run. Playback holds its presentation clock until its required assets arrive while retaining pause/play intent. Failures remain explicit; late results release resources after a view retires. Root's final integration gate must exercise failure/delay and lifecycle transitions against actual assets; transport-specific development tests remain relevant where production inlines small GLBs.
