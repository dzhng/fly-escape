# Retinal vision choices

Review first: the modeled relationship between screen colors and neurons, the revised frozen stimulus designs, and the cost and portability of the selected quality and practical budgets. These are useful explicit models, not measurements of biological vision. Confidence below means confidence that the user would make the same decision; it does not grade an experiment's result.

This consolidates the surviving choices from reference reproduction through whole-feature review. Explicit user choices and delegated budgets are included as inherited constraints, not requests for renewed approval. Experimental results belong in their evidence reports.

## Needs-user

None. No surviving decision requires a new product, cost or taste choice before work can continue.

## Unsound

None identified in this bounded consolidation. Superseded implementations and their fixes are omitted; the ledger describes the current decisions.

## Sound — medium confidence

### Use an explicit approximation for color-sensitive neural input

**When:** color-model and retinal-map implementation. **Choice:** when a fly sees a blue patch, its saved red/green/blue values feed two existing neuron families: Tm2 receives weighted brightness and Tm20 receives a modeled blue response. The numeric channel weights and saturation describe an engineered approximation. They do not reconstruct ultraviolet light, measured receptor spectra or the fly's subjective colors. A brightness-only alternative would discard the independent color dimension; adding invented receptors would assert biology absent from the retained graph.

**Gap:** the user required color to affect the circuit, but the source data did not supply a calibrated RGB-to-neuron response. **Reach:** future physiological claims require a different evidential basis and a newly identified model. **Verdict: sound; confidence: medium.** Freeze and label the approximation rather than tuning it toward desirable movement.

### Map known cell positions and expose missing coverage

**When:** source audit and sparse-map implementation. **Choice:** when a sample falls near a retained visual cell's source position, that cell receives a small weighted combination of nearby samples. Positions are translated from the full source eye's coordinate system into the fixed sample layout; each cell uses at most three local samples. Tm5 and three Tm20 cells lacking the required source positions are excluded. Some visible samples therefore have no mapped neural recipient. The alternative—guessing positions or stretching the retained subset to fill the picture—would conceal missing evidence.

**Gap:** source annotations do not define a complete biological retina or an exact registration to this camera. **Reach:** displayed resolution and neural coverage are different quantities; adding cells requires new source-backed mapping, not merely a larger image. **Verdict: sound; confidence: medium.** The coordinate registration remains a model, and coverage holes remain visible in the audit.

### Freeze stronger test images independently of neural outcomes

**When:** controlled neural experiments and subsequent input-only revisions. **Choice:** to ask whether location matters, compare declared image patches and physical doorway views; to ask whether color matters, exchange supported colors while controlling brightness and delivered current. Revised spatial patches use a fixed 64-sample support, and the floor doorway comparison uses its declared physical scene. Images are selected using image geometry and the current delivered to input cells, then frozen before the reserved neural runs. An alternative that repeatedly changes images, seeds or measured cells after seeing the neural answers would change the question to fit its answer.

**Gap:** the original request did not uniquely determine useful controlled stimuli. **Reach:** image construction, seed sets, measured cells and statistical rules become part of each experiment's identity. Prior experiments remain separate; choosing this design does not establish its downstream result. **Verdict: sound; confidence: medium.** Keep model, gain, endpoints and acceptance rules fixed across the declared confirmation, with any future change treated as a new experiment.

### Test a second brightness context without calling it scaled color

**When:** repeated chromatic-contrast design. **Choice:** the second context adds red/green light while preserving the declared difference in blue-driven current between the paired images. For example, the pair can become brighter without doubling every RGB component. A multiplicative alternative would change both brightness and chromatic dose, asking a different question.

**Gap:** “repeat at another brightness” did not specify how to hold the color contrast constant. **Reach:** results describe this additive context change, not invariant chromaticity or every illumination change. **Verdict: sound; confidence: medium.** Name the operation precisely and retain its native current controls.

### Bind the map to its original exported text

**When:** native initialization. **Choice:** the worker fetches the map as text and passes that original text into the native loader. A hash—a fingerprint of the exact bytes—binds the reviewed profile and color descriptions. Parsing and printing the same decimal differently can change that fingerprint and is rejected. The alternative would require both languages to implement and maintain exactly the same number-printing rules.

**Gap:** the plan required identity checks without choosing a cross-language JSON formatting convention. **Reach:** new loaders must preserve original map text; semantic reformatting is not a supported artifact transformation. **Verdict: sound; confidence: medium.** A narrow exact-artifact interface is easier to verify than a second formatter.

### Retain the selected quality and use delegated practical budgets

**When:** higher-resolution selection and final budget reconciliation. **Choice:** each eye captures 128×128 pixels, pools them into 721 RGB samples, and supplies a new observation every simulated tenth of a second. The user rejected the coarse views and delegated practical budgets. The archive cap is 512 MiB; production is measured against simulated time and separate responsiveness targets. The user’s shipping instruction accepts the functional capability without further tuning toward every latency target. The earlier relative-cost target remains diagnostic history. Lowering resolution, dropping color or slowing sensing would alter the accepted experience instead of choosing an engineering budget.

**Gap:** the initial coarse profile and budget were agent assumptions, superseded by user direction. **Reach:** this budget is accepted on the development Mac with hardware-accelerated Chromium; it does not promise the same memory availability or speed on other devices. The larger archive may be costly on less capable machines, and larger workloads require explicit admission and resource accounting; the cap is not permission for unbounded allocation. A run that exhausts capacity fails explicitly rather than evicting historical eyes. **Verdict: sound; confidence: medium.** The user delegated the budget, but the selected hardware boundary limits portability. Retain that scope explicitly; this is not a new permission request or a claim of measured success.

## Sound — high confidence

### Reproduce the reference sampler without importing its entire simulator

**When:** reference reproduction. **Choice:** generated asymmetric camera pictures are passed through the pinned original sampler to check projection, channel handling and sample order. Its historical green/blue display is retained as reference evidence, including its weak cyan boundary. Product input retains all three RGB channels. Running the original full simulator would answer a broader world-reproduction question, while copying its display colors into sensory input would discard red.

**Gap:** the reproduction boundary and evidence presentation needed concrete selection. **Reach:** this reference establishes sampler correspondence, not a claim that the game's room is the reference demonstration. **Verdict: sound; confidence: high.** Keep the independently callable source and the product's separate RGB contract.

### Place eyes by physical body coordinates

**When:** reference-axis translation and asset rig. **Choice:** when the native body tilts or rises, each camera follows its full position and rotation through fixed eye mounts. Left and right mean physical sides, not an asset filename suffix. The reference axes are translated with a proper rotation, preserving handedness. A heading-only alternative would make a tilted or flying body's input disagree with its pose; animated presentation bones would make sensing depend on display animation.

**Gap:** the reference and game assets use different axes and naming conventions. **Reach:** later articulated or stabilized eyes would change the optical model and require a new identity. **Verdict: sound; confidence: high.** The native pose remains the authoritative sampling pose.

### Quantize once and replay exactly what the brain received

**When:** acquisition and record implementation. **Choice:** the GPU pools linear-light colors using its ordinary 32-bit arithmetic and rounds to three one-byte channels. Those bytes go to the native tick and into the archive unchanged. Rewinding paints the saved bytes; it does not render the room again. A higher-precision CPU reference may differ by one rounding level and serves as a check, never as a replacement runtime answer.

**Gap:** the plan needed a single numerical owner across GPU, native consumption and playback. **Reach:** recordings remain truthful even if browser rendering changes; cross-device rendering need not be bitwise identical. **Verdict: sound; confidence: high.** One canonical byte sequence prevents competing definitions of what the fly saw.

### Share one bounded neural dose between the two visual families

**When:** color adapter, map export and final metadata cutover. **Choice:** adding color divides the allowed total input between brightness and color families rather than giving each a fresh full allowance. Native loading validates compact source fingerprints and the frozen aggregate weight budget; it does not retain the old directional sampler or its runtime weights. When comparing colors, controlled inputs also hold delivered dose equal so “different color” is not merely “more input.”

**Gap:** adding a new family could otherwise silently increase stimulation. **Reach:** map changes must preserve or explicitly revise the source-bound budget, and mapped motor readouts remain forbidden. Existing left/right visual activity groups include the mapped families within the existing record capacity. **Verdict: sound; confidence: high.** Source provenance survives without keeping an obsolete visual execution path.

### Snapshot a shared physical world with independent resource ownership

**When:** shared-world extraction and integration. **Choice:** starting an attempt copies the physical room definition before asynchronous loading; both its fingerprint and its meshes use that copy. Authored daylight and fixtures use the same lighting resolver as the visible room. Real openings, surfaces and placement appearance matter; scoring cues, player cutaways, overlays, other flies and decorative animation do not enter this static sensory world. Sharing the live player scene instead would let the player's camera or later mutation change neural input.

**Gap:** shared authoring did not imply safe sharing of mutable render objects. **Reach:** each world releases its own mutable geometry and resources. Compatible static leaf meshes may be merged by material after loading; merged geometry is released separately and source materials remain with their loader. Parent meshes with children are left intact. **Verdict: sound; confidence: high.** Shared construction preserves appearance while independent ownership prevents cross-world changes and disposal errors.

### Keep one acquisition inside the existing native tick

**When:** native prepare/commit and worker integration. **Choice:** for each tick, the worker asks native code for the frozen active body poses, captures those eyes, and supplies the matching batch before neural computation advances. A second prepare does not advance time, and a duplicate or mismatched commit cannot advance it twice. In decision terms: `prepare → acquire → validate identity and shape → commit once`. Capturing according to display frames would make simulation depend on viewing speed.

**Gap:** the external renderer needed a concrete rendezvous with native ownership. **Reach:** there is one pending batch and bounded chunk credits, not a separate per-eye queue or second simulation loop. Cancellation invalidates late replies. **Verdict: sound; confidence: high.** The existing native tick remains the single owner of state advancement.

### Fail stalled work through its owners and rebuild on explicit retry

**When:** worker integration and whole-feature recovery review. **Choice:** a GPU wait has a bounded progress deadline, while a main-thread watchdog can retire a worker whose own event loop has stopped. Setup also has a deadline and is frozen during an active attempt. Cancellation aborts map and physical-asset loading; late resources are released. Retry creates valid ownership again instead of feeding stale images, black images or partially advanced state.

**Gap:** a timeout inside a stalled worker cannot report its own failure, and cancellation must reach asynchronous loaders. **Reach:** hidden-page suspension pauses the relevant progress clocks; it is not counted as a GPU fault. On resume, monitoring continues. An old idle notification does not clear monitoring while newly granted chunks remain outstanding. **Verdict: sound; confidence: high.** Deadlines follow actual owned work, with explicit recovery rather than silent fallback.

### Revalidate map retrieval on each attempt

**When:** browser integration. **Choice:** when the user retries after a bad map response, the new attempt fetches and validates the map again. Browser HTTP caching can revalidate resources, but the worker does not keep a rejected promise or unvalidated application cache. An additional cache could otherwise preserve the same bad result across retries.

**Gap:** repeated initialization left caching policy unspecified. **Reach:** corrected responses can recover without inventing another pending/valid/invalid cache state machine. **Verdict: sound; confidence: high.** Retrieval and validation remain cheap, explicit initialization steps.

### Keep large RGB arrays in the archive, outside ordinary UI updates

**When:** replay and profiling integration. **Choice:** ordinary playback updates contain body and neural summaries, while the selected fly's eye painter reads its bytes directly from the archive. Switching flies changes which saved samples are read; it does not copy all eyes into component properties or trigger capture. Presence metadata distinguishes a real black image from a tick with no input, including a terminal-transition tick that did consume input.

**Gap:** exact retention did not require every presentation update to materialize all RGB data. **Reach:** instrumentation and UI updates remain bounded by displayed information, while the complete archive remains available. **Verdict: sound; confidence: high.** Separate retained data from the small view currently being painted.

### Reject unsupported recordings without a compatibility engine

**When:** schema-six replay and recovery integration. **Choice:** loading an older recording checks its version before interpreting its buffers, then shows a recoverable unsupported-record message. Corrupt current records are reported as invalid instead. The user explicitly chose no migration or old decoder; saved progress and arrangements are separate from this recording format. An old decoder would become an additional permanent interpretation of every historical field.

**Gap:** the handling path needed to implement the user's “do not crash” requirement. **Reach:** future formats keep a safe rejection boundary. Likewise, non-neural brightness fields can still exist for field diagnostics, but visual neural cues require paired RGB and cannot fall back to old directional vision. **Verdict: sound; confidence: high.** Remove obsolete execution paths while preserving clear recovery.

### Use real production and native owners for diagnostics

**When:** one-fly workbench and resource diagnostics. **Choice:** the one-fly demonstration runs the ordinary producer from a fixed start and exports its start information, configuration and recorded frames for native reconsumption. History controls read the archive. Stage messages expose whether the existing worker is capturing or computing without creating another observer-owned RGB stream. Optical fixture controls restore their own placement definition after inspecting an attempt, so the displayed scene matches the requested fixture.

**Gap:** diagnostic convenience could otherwise create another simulation or scene owner. **Reach:** exporting the same recorded input lets the native consumer check the actual producer rather than a second implementation. Resource diagnostics can extend both rooms to 6,000 ticks without editing their authored playable timers. **Verdict: sound; confidence: high.** Diagnostics reuse production behavior and clearly state the different question they measure.

### Preserve native roster interaction in the requested horizontal strip

**When:** eye-panel and roster integration. **Choice:** the sixteen existing fly buttons occupy one horizontally scrolling strip. Clicking, keyboard selection or external selection brings the chosen card fully into view; a scroll cue indicates that more cards exist beyond the viewport. A custom carousel or another selection state would add interaction rules and synchronization work that the user did not request.

**Gap:** the requested layout needed overflow and selection behavior at narrow widths. **Reach:** button labels, keyboard order and the existing selection owner remain the accessibility and interaction contract. **Verdict: sound; confidence: high.** The user's layout choice uses ordinary scrolling rather than a new navigation system.
