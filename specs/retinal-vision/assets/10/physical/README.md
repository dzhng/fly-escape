# Physical recorded-eye evidence

These panels display color samples captured by the production worker from the authored campaign room. The fixture changes only the attempt horizon; all sixteen flies use native movement, physical eye poses, scene assets and lighting. The displayed time identifies the consumed input at the start of that tick, while the spectator world follows the ordinary playback body state. The eye image is therefore not expected to equal a crop of the spectator camera.

The [fixture](../../../../../tests/browser/physical-eyes-fixture.tsx) mounts the actual playback UI and observes the production transport into a separate archive. It clones each incoming chunk because an archive takes ownership by detaching the supplied buffers. This test-only copy does not enter production playback or React state.

The [browser check](../../../../../tests/browser/physical-eyes.mjs) compares each rendered canvas against the archived RGB after the shared projection’s display conversion. [The report](report.json) preserves source profile/scene identities, every selected fly’s acquisition pose and RGB digest, and the asserted outcomes. The checks cover every fly, backward seeks across a chunk boundary, terminal input, spectator camera invariance and vertical scrolling at both widths. Distinct physical-record digests prevent identical placeholder images from satisfying the test.

The visual target is two complete, clearly labeled physical eye mosaics above the retained brain view, with the circuit-input footer and acquisition time readable. Full frames, detail views, eye crops and bottom-of-panel captures are preserved at both widths. The earlier controlled-pattern evidence tests discrimination; these captures establish that actual production scene samples reach the same UI.

Typechecking and the complete browser run pass. Independent code review found no actionable defects and separately passed the web tests and script syntax check. Fresh unprimed visual critique is **pending** in the integrating task; these screenshots are candidate evidence, not an accepted visual verdict.
