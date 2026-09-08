Bounded recheck done. Read-only; no tests run, no files changed.

## Closeout corrections

| Claim | Status |
|---|---|
| Archived `choices.md` camera-size statement avoids the stale 24 constant | ✅ `specs/done/help-the-fly-escape/choices.md:100` now says "toward the camera's readable screen-size target with a world-size ceiling and a 0.8 growth exponent" — no numeric constant; `packages/game-renderer/src/camera.ts:14` has `READABLE_PIXELS = 48` and `:18` the room-fraction ceiling |
| `GAMEPLAY.md` says 60-min diagnostics need a scratch build vs 10-min shipping | ❌ **Not applied** (see below) |
| Archived README mock-review line no longer attributes trails | ✅ `specs/done/help-the-fly-escape/README.md:35` credits only close framing and world/card selection; the trails control remains stated in `assets/ui/mock-review.md:5`, where it belongs |
| Band link points to `31/foreground-walls` | ✅ `README.md:13` links `assets/evidence/31/foreground-walls/README.md`, whose line 7 records "translucent foreground planes form pale overlapping bands" |
| `outdoor-inspiration.png` exists | ✅ `specs/done/help-the-fly-escape/assets/ui/outdoor-inspiration.png`, linked correctly from archived `README.md:37` |

## Remaining factual defect

**`specs/done/help-the-fly-escape/GAMEPLAY.md:35`** — the sentence still reads "Diagnostic runs may extend to sixty simulated minutes to distinguish slow progress from trapping; this is not the intended player round length." There is no mention of a scratch build anywhere in the file (no match for `scratch`, and nothing in the shipping-acceptance paragraph at :67). As written, the doc implies a 60-minute run is reachable in the shipped stack, but the horizon is hard-capped at 6000 ticks (10 min at 10 ticks/s) in four independent validators: `crates/sim/src/body.rs:394`, `crates/sim/src/record.rs:150`, `crates/game-wasm/src/attempt_session.rs:291`, `packages/sim-client/src/record.ts:89`. A 60-minute run (36000 ticks) requires modified code. The lifecycle/swarm lab does not exempt it — `crates/sim/src/swarm_lab.rs:99` also uses 6000.

## Public docs

`README.md` and `docs/development.md` pass. Spot-checks: all 19 linked paths resolve; `#data-attribution` exists at `scripts/connectome/README.md:13`; every command in Run locally and Verify maps to a real script in `package.json` (`data:prepare`, `build`, `dev`, `test`, `typecheck`), and the `bun run test` description matches the seven sub-scripts at `package.json:13`; the "roughly 1.1 GB" download matches the three source entries in `assets/evidence/01/manifest-summary.json` (1,109,008,094 bytes); `tests/browser/` exists and is excluded from the default suite.
