# Help the Fly Escape

A local browser game where a fly connectome drives the flies and the player shapes their environment to help them escape.

**Biology → simulation → observed behavior → game design.**

We build game mechanics around the behavior we discover, rather than forcing the simulation to produce mechanics chosen in advance. Real connectivity is the foundation; sensory inputs and modeled dynamics still need biological grounding. We document those assumptions, observe the results, then craft interesting puzzles around the behavior that emerges. Biologically motivated circuits can remain available even when responses are variable or not fully explained: discovery through play is part of the game. The practical requirement is that players can meaningfully influence the swarm, not predict every fly.

The home route opens the in-progress two-level campaign, where placements precede a buffered attempt. Diagnostic views include a neural observation chamber at `/lab/brain`, matched sensory chambers at `/lab/fields`, finite-life probes at `/lab/lifecycle`, and buffered swarm replay at `/lab/playback`: the real neural graph runs in Rust/WASM in a Worker, while the 3D view and measured activity stay responsive. Randomized starting swarms and furnished houses are integrated. The current appearance is accepted for MVP; object-effect calibration, puzzle balance and release verification remain under development. Follow the [active specification](specs/help-the-fly-escape/README.md) for completed gates and the next checkpoint.

## Run locally

Requires Bun, Rust with the `wasm32-unknown-unknown` target, wasm-pack, and Python/uv. On a fresh checkout:

```sh
uv venv .venv
uv pip install --python .venv/bin/python -r scripts/requirements.txt
bun install
bun run data:prepare
bun run build
bun run dev
```

Open the printed local URL. Source preparation downloads about 1.1 GB once and produces a small static graph artifact. See [graph preparation](scripts/connectome/README.md) for provenance and reproducibility, and [reference fixtures](scripts/reference/README.md) for the numerical oracle.

## Serve the static build

After `bun run build`, serve the game distribution:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory apps/web/dist
```

Open `http://127.0.0.1:4173/`. Keep the distribution at the origin root: workers load `/brain/` data, and asset URLs are rooted there. Serve through HTTP rather than opening the HTML file directly. No application backend is needed. The About link uses a query on the root document, so this simple server needs no route fallback for it; direct `/lab/*` diagnostic routes require a server with an index fallback.

The in-app About page explains data attribution and modeling limits and links to the bundled graph manifest. Static serving alone is not release acceptance; production performance and platform gates remain in the active specification.

## Ownership

Browser applications live under `apps/`: `apps/web` is the game and [`apps/asset-lab`](apps/asset-lab/README.md) provides local model replacement and inspection. `packages/` holds the client and renderer; `crates/` owns simulation and its thin WASM boundary. The browser requires no application backend.

Python is used only for offline graph preparation and faithful numerical reference evidence. Historical experiments and their interpretation remain in the [spike archive](specs/help-the-fly-escape/spikes/README.md); they are not runtime behavior or release guarantees. The [architecture contract](specs/help-the-fly-escape/CONTRACTS.md) defines the final shape and the [roadmap](specs/help-the-fly-escape/visualizations/roadmap.html) shows the remaining work.

[Native fly contact](assets/fly/README.md) describes the physical envelope and its animation-sampling limits.

[House assets](assets/house/README.md) describes the shared native furniture envelope and authoring contract.

[Food assets](assets/food/README.md) separates edible geometry, scent cues and unregistered shape studies.

[Household assets](assets/household/README.md) describes native room props; runtime integration follows the active specification.
