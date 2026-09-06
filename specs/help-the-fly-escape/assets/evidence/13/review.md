# Science panel preparation

Status: prepared for integration, not slice acceptance. Dependencies retain their independent gates.

Every card keeps all source-defined activity nodes plus voltage and spike-fraction traces. The trace selector chooses a group independently for each fly. This replaces the selected-only numeric inspector, not the shared selection owner. The panel consumes `AttemptInfo.groupLinks`; it never infers wiring from body motion or recomputes connectivity.

The dense full-link graph was unreadable in independent review. The displayed network therefore shows connections touching the chosen group, explicitly labeled; all activity nodes remain. Two columns leave a central space for links and keep arrows away from labels. The diagrams are structural summaries, not live synapse animations. Tooltip wording identifies inherited candidate pathway selections and does not treat their names as anatomical proof.

`FrameArchive.neuralTrace` reads a bounded window from packed records. It never calls `frame()` or stores full decoded history. Missing neural samples remain gaps. Only cards near the viewport request trace samples; their data remain in the archive and are reread when visible. Group measurements always use the world’s integer playback tick.

## Verification

- New packed-trace test failed before implementation, then matched the Rust record fixture exactly across seeks, groups, chunks and terminal missing samples. All 13 client tests pass (123 assertions).
- Typecheck and production web build pass.
- Existing playback pause/seek/2×/replay/restart check passes after moving its readout assertion to the selected card. It still checks repeated recorded values and the shared cursor.
- `tests/browser/science-panel.mjs` checks 20 stable cards, both plots on every card, common timestamps, last-card keyboard selection, group selection, hover and keyboard explanation, and desktop/narrow viewport containment. It also verifies pointer travel to the explanatory overlay leaves it readable.
- An actual 20-fly browser production run reached all 6000 ticks. Seeking to the end retained all 20 cards in stable order with `timedOut` outcomes (`terminal.json`). The terminal tick legitimately contains its final neural measurement because timeout follows that tick’s update. Separate packed-fixture tests pin absent measurements after earlier terminal transitions. `terminal.png` records the earlier functional layout; current appearance is in the six panel/card/tooltip captures.

## Sources and assumptions

The explanatory text teaches integration, leak, spike threshold, reset, refractory periods, group averages and excitation/inhibition, not placement strategy. [Gerstner et al.](https://neuronaldynamics.epfl.ch/online/Ch1.S3.html) supports the simplified dynamics. Primary circuit context includes [LC4 looming pathways](https://www.nature.com/articles/s41586-022-05562-8), [the anterior visual pathway](https://www.nature.com/articles/s41586-024-07967-z), and [descending motor circuits](https://www.nature.com/articles/s41586-024-07523-9). These publications describe biological circuits; they do not validate the inherited candidate body-ID lists. Each tooltip makes that distinction and identifies its concrete group ID and member count. Model voltage and update timing are not physical measurements of a living fly.

## Visual review

Target: a readable circuit summary and both scientific quantities together on every fly card, with detailed explanations accessible without clipped text. Initial fresh reviews found dense crossing links, tiny tick labels and a zero trace that resembled an axis. The current two-column network, larger annotations and offset zero trace address these findings. Desktop explanations sit beside the panel; narrow viewports use a bounded overlay.

The pre-change production-route screenshot and pixel differences are retained under `before/` and `diff/`. World art and cursor framing differ between captures, so whole-frame distance is diagnostic only; the changed panel contains the actual new information. The approved mock is an interaction/density reference, not a source of scientific values.

Human checkpoint opened at 18:00:45 UTC on September 6: panel, individual card, and detailed explanation. No correction arrived during the five-minute window. Proceed provisionally with the readable two-column candidate and explicit selected-group trace choice; Preview closed after proceeding. The final independent review is recorded below.

Closeout shape review kept archive reads in sim-client, scientific presentation in one card component, and shared selection in playback. Obsolete roster/table styles were removed from playback instead of layering a second card owner. No new dependency, simulation behavior, backend or full-neuron history was introduced. CLI second-opinion review remains unavailable under the configured client/model limitation recorded by the parent implementation; independent visual reviewers covered every candidate state instead.

Final visual follow-up: additional fresh-agent creation and reuse both hit the system thread limit. Earlier independent reviews already covered all current card/tooltip states; the last remaining axis comment was addressed by printing start, midpoint and end time directly on each plot. Parent performs a separate image-only inspection, and the implementer’s adversarial check uses the last card, narrow tooltip, and exact card crop. Remaining same-column link crowding is disclosed as a compact graph limitation; labels remain outside its central link area. Narrow overlays necessarily obscure the card until closed, while desktop allows simultaneous reading.

Parent image-only inspection found no new blocking text or clipping issue in current card, desktop tooltip or narrow tooltip. Scientific prose explains cells and model assumptions; same-column arrows remain somewhat dense, with readable node labels. Integration still needs captures with the latest scaled fly asset; this preparation’s world art is not a slice-07 acceptance claim.
