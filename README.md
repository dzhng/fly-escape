# Help the Fly Escape

A local browser game where a fly connectome drives the flies and the player shapes their environment to help them escape.

The browser currently has a neural observation chamber at `/lab/brain`, matched sensory chambers at `/lab/fields`, and finite-life probes at `/lab/lifecycle`: the real neural graph runs in Rust/WASM in a Worker, while the 3D view and measured activity stay responsive. The full five-level game is still being built. Follow the [active specification](specs/help-the-fly-escape/README.md) for completed gates and the next checkpoint.

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

Open the printed local URL with `/lab/brain`. Source preparation downloads about 1.1 GB once and produces a small static graph artifact. See [graph preparation](scripts/connectome/README.md) for provenance and reproducibility, and [reference fixtures](scripts/reference/README.md) for the numerical oracle.

## Ownership

Browser applications live under `apps/`: `apps/web` is the game and `apps/asset-lab` is planned for asset iteration. `packages/` holds the client and renderer; `crates/` owns simulation and its thin WASM boundary. The browser requires no application backend.

Existing Python simulation code is disposable spike material. Retain useful evidence, adapt useful algorithms into their natural owner, and delete obsolete paths as their consumers retire. No compatibility or data migration is required. The [architecture contract](specs/help-the-fly-escape/CONTRACTS.md) defines the final shape and the [roadmap](specs/help-the-fly-escape/visualizations/roadmap.html) shows the remaining work.
