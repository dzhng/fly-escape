# Help the Fly Escape — shipped MVP rationale

The local browser game couples a real fly connectome to a modeled body and environment. Players arrange objects, release a swarm, observe its behavior and try again. The two authored houses, recorded neural activity and replay make that experimentation playable without an application backend.

**Biology → simulation → observed behavior → game design.** Connectivity is real; sensory encoding and body dynamics are models. The game invites discovery without presenting uncertain circuit behavior as established biology. [Game principles](GAMEPLAY.md) describe the player experience, [architecture contracts](CONTRACTS.md) describe ownership, and [choices](choices.md) records the surviving design decisions.

## Accepted scope

On 8 September 2026 the user accepted somewhat working mechanics and prioritized shipping over further balancing. The [final static-build checks](assets/evidence/release-final/README.md) cover both complete campaign levels, replay, retry, pause, selection, camera controls, earned unlocks and saved progress. Firefox and WebKit have short setup/simulation/cancellation smoke coverage, not complete performance qualification.

The [graded-odor browser comparison](assets/evidence/33/graded-browser/README.md) demonstrates a placement changing escape outcomes in an actual house. It is limited evidence of player influence, not a guarantee that every object or layout helps. Reliable repulsion, campaign holdout calibration, a ten-percent three-star rate, and hundred-fly performance are deferred. Existing star thresholds remain unchanged. Feeding and life extension are also deferred; timed rounds retain food odor and physical contact.

Startup remains the main known limitation: production checks waited tens of seconds before playback, and another standalone run took about 115 seconds. The earlier startup/performance targets are not claimed as passed. Current visuals are accepted for MVP; residual cutaway-wall bands and other cosmetic issues are recorded in [foreground-wall evidence](assets/evidence/31/foreground-walls/README.md).

## Why these boundaries matter

Rust owns the sparse neural computation and physical simulation; a Worker isolates that work from interaction. TypeScript owns browser presentation and playback. This adopts the useful separation of the user's reference repository without importing a large framework. [Contracts](CONTRACTS.md) name the seams; the [simulation](../../../crates/sim/src/), [client](../../../packages/sim-client/), and [renderer](../../../packages/game-renderer/) own their implementation.

Recorded motion and activity keep the world, fly previews and explanations synchronized. Replaying an attempt must not produce a new random outcome or award progress twice. The [attempt owner](../../../crates/sim/src/attempt.rs), [campaign](../../../apps/web/src/campaign.tsx) and [progress tests](../../../apps/web/src/progress.test.ts) anchor that separation.

Physical exit crossing determines escape. The user explicitly allowed a local exit pull as physical assistance; it does not supply route instructions to the brain. Rendered size compensation, selection rings and escape-departure animation remain presentation. [Body motion](../../../crates/sim/src/body/), [sensory encoding](../../../crates/sim/src/sensory.rs), and [departure playback](../../../apps/web/src/departure-tail.ts) are the relevant owners.

Objects retain ordinary emissions. Detected odor concentration modulates neural input through a bounded modeled response; it does not change neural signs to force an intended game effect. Fan-free comparisons keep physical blowing from concealing weak sensory behavior. The explanatory interface describes neuroscience while leaving object discovery to play.

## Findings worth keeping

The earlier binary odor input discarded dose information after detection. Graded input preserves concentration information while retaining the existing detector and pathway identity. [Dose experiments](assets/evidence/33/scent-strength/README.md) and [integration evidence](assets/evidence/33/graded-browser/README.md) document that choice and its limits.

A banana-only emission boost was a diagnostic isolation experiment. [Tripling every odor source](assets/evidence/33/global-scent/README.md) did not establish better placement control, so neither boost became a production rule. [Clustering bananas](assets/evidence/33/clustered-bananas/README.md) also failed to outperform spreading in the small comparison. These are reasons to preserve uncertainty, not universal strategy advice.

Food attraction does not imply a useful route: approach, residence and escape can disagree. [Food-strategy evidence](assets/evidence/32/food-strategy/README.md) preserves that distinction. Excitatory and inhibitory names do not establish attraction and repulsion; [biological grounding](assets/evidence/32/food-strategy/biology.md) separates source evidence from modeled mappings. Historical spikes remain under [spikes](spikes/README.md), and the original plan under [superseded](superseded/README.md) is historical rather than current acceptance.

## Visual provenance

The [approved mock review](assets/ui/mock-review.md) records the user's close framing and world/card selection. Its [default view](assets/ui/review-default.png) and [close crop](assets/ui/review-close-crop.png) are design references, not simulation evidence. The user's [rejected focus indicator](assets/ui/rejected-focus-indicator.png) explains why world selection uses a yellow ring.

The user requested a warm, lived-in house, Sims-inspired wall visibility and sunlit grassy outdoors. Their [outdoor inspiration screenshot](assets/ui/outdoor-inspiration.png), captured from VibeCodeBoss’s Windborne video, drove the tall grass, wind, rocks and sunlit palette; it is an aesthetic reference, not this game’s render. The [wall comparison](assets/evidence/24/sims-walls/README.md) preserves before/after captures for the cutaway interpretation, and [foreground-wall review](assets/evidence/31/foreground-walls/README.md) records the later correction. The [presentation archive](assets/evidence/31/README.md) and [final production captures](assets/evidence/release-final/README.md) show the resulting game. All earlier imagery and experimental captures remain under [assets](assets/); historical mock limitations do not describe current functionality.

[Research](RESEARCH.md), the [discovery interview](BROWSER_GAME_MAP.md), and [planning synthesis](assets/planning/synthesis.md) preserve the origins of these decisions. They are historical records, not an active build queue.

[Fullscreen overlays and golden outdoors](assets/evidence/34-game-overlays/README.md) record the subsequent presentation update and the user-requested sixteen-fly campaign. Earlier release captures retain their original twenty-fly evidence scope.
