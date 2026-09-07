# Sustained campaign retry harness

The existing retry harness now supports `RETRY_FULL=1` on an actual campaign level. Its default still releases, pauses and cancels. Full mode plays naturally at 1× through the recorded result, then returns to setup. Every fly must have a terminal outcome; cursor and computed ticks must equal the result tick. An elapsed-time check rejects skipping most of the playback interval. Frame samples must exist and p95 must meet the existing 25 ms desktop target.

A complete attempt may finish before the level time limit when all flies are terminal. The first draft incorrectly required the maximum duration; `rejected-forced-horizon.json` records an honest completed 306-tick run with 20 starved flies that this test rejected. The corrected oracle uses the result's completion tick, without changing production behavior.

Per-attempt reports are saved before assertions. Startup/completion failures also retain the current raw report, screenshot and error. Post-warm-up DOM comparison requires at least three runs, so it cannot compare a second sample to itself. Heap samples and an offline snapshot remain observations; they do not prove combined GPU/Worker/process memory stability.

For the eventual ten-attempt gate, serve the current built web distribution and run from repository root:

```sh
RETRY_FULL=1 RETRY_CAMPAIGN=2 RETRY_RUNS=10 RETRY_ASSERT_STABLE=1 \
RETRY_EVIDENCE=/tmp/fly-release-retries BRAIN_URL=http://127.0.0.1:5322 \
node tests/browser/retry-resources.mjs
```

The release still requires final content, full input/hidden-tab and platform coverage, combined memory evidence and campaign reliability. This harness is not a solvability test.

## Newly captured failure

The three-run check found a real second-house failure on seed 1744322718178062846: `numerical motion unresolved: refinement budget`. The producer had supplied 50 ticks; playback froze near tick 9.17. `failure.json` preserves the exact attempt and raw diagnostic report, and `failure.png` preserves the interruption view. This reopens the contact/release gate. The harness now also treats an explicit startup error as terminal immediately, rather than waiting for its startup timeout. No seed substitution or performance-threshold change resolves this production failure.

## Harness validation

The previously recorded seed `13417148680701230168` completes through its actual all-terminal result at 1× with the current harness; the default pause/cancel path also passes. A scratch copy clicking 2× fails the normal-speed assertion and saves diagnostics (`rejected-double-speed.json`). Requesting stability comparison with only two runs fails before launching Chrome. The failing contact seed now reports its native error immediately (`immediate-error.json`). These checks validate the harness; they do not substitute a successful seed for the unresolved release failure.

`RETRY_SEEDS` accepts a comma-separated list of distinct recorded unsigned 64-bit seeds, one per attempt; without it, ordinary random starts remain. The harness injects only the one-value 64-bit RNG call used for attempt seeds, leaves other randomness alone, and checks each resulting attempt identity. For exact reproduction of the unresolved case:

```sh
RETRY_FULL=1 RETRY_CAMPAIGN=2 RETRY_SEEDS=1744322718178062846 \
RETRY_EVIDENCE=/tmp/fly-refinement-repro BRAIN_URL=http://127.0.0.1:5322 \
node tests/browser/retry-resources.mjs
```

The single completed-run heap passes the existing offline renderer-retainer check: one attached world canvas, no detached world canvas, and one current lighting-texture disposal listener. This is a retainer check, not a repeated-memory plateau.
