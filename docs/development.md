# Developing Help the Fly Escape

The browser owns a complete playable session. A static host only delivers files; it does not compute the flies, store accounts or decide outcomes. For initial dependency and graph setup, use [Run locally](../README.md#run-locally).

## Build and serve

`bun run build` generates the wire types, copies verified brain data, compiles Rust to WebAssembly and builds the browser applications. Serve the game distribution at the origin root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory apps/web/dist
```

Open `http://127.0.0.1:4173/`. Use HTTP rather than opening the HTML file directly: Worker, graph and asset loading depend on it. The game and About page work on a plain static file server. Direct diagnostic `/lab/*` URLs need a host that falls back to `index.html`.

During development, rebuild WASM after changing Rust; the web development server does not compile Rust for you. The prepared graph and its manifest are versioned build inputs; a fresh checkout can build without downloading the original dataset. The [graph preparation guide](../scripts/connectome/README.md) owns download, extraction and provenance details.

## Where changes belong

**Simulation — [crates](../crates/).** Rust owns neural updates, sensed fields, contact and outcomes. Keeping them together lets recorded attempts preserve the same physical and numerical rules as live computation. The WASM boundary exposes that owner rather than reproducing it in JavaScript.

**Browser transport and rendering — [packages](../packages/).** The client moves bounded chunks from a Worker into a replay archive. The renderer displays recorded state; a visual adjustment must not silently change an escape, collision or neural input.

**Game and workbench — [apps](../apps/).** The game composes editing, progression and observation. The [asset workbench](../apps/asset-lab/README.md) exercises the production model loader and renderer, so replacement previews test the same path players see.

Resource lifetime follows the player's session: a level's visible world survives editing and playback, while each attempt starts with fresh simulation state. The campaign owns the reusable client. A roster owns its parsed preview model; only immutable downloaded bytes may outlive it. Sharing disposable model objects can let GPU listeners retain retired renderers. The [retry rationale and evidence](../specs/fast-retries/README.md) explain the ownership tradeoffs and measured bounds.

**Artwork — [assets](../assets/).** Visible geometry and physical contact must agree. The [fly](../assets/fly/README.md), [house](../assets/house/README.md), [food](../assets/food/README.md), [household objects](../assets/household/README.md), and [object registry](../assets/tools/README.md) document their authoring boundaries. The [shared proportions](../assets/proportions/README.md) connect native dimensions across Blender, Rust and the browser.

The [architecture contracts](../specs/done/help-the-fly-escape/CONTRACTS.md) record the invariants crossing these boundaries. The [dependency patch](../patches/README.md) explains the local renderer change and why it exists.

## Verify the behavior you change

`bun run test` requires the optional Python environment described in [graph preparation](../scripts/connectome/README.md) and runs the offline graph/reference checks, Rust tests, and client, renderer, workbench and game unit tests. `bun run typecheck` checks the TypeScript boundary. Browser harnesses live under [tests/browser](../tests/browser/); use the relevant harness against a built or development site when changing interaction, transport or rendering. They are separate from the default unit suite.

A deterministic fixture checks reproducibility. It does not establish how an object affects a swarm. For sensory changes, compare the same seeds and environment with and without the changed placement; distinguish approaching an object, remaining near it and escaping. Keep physical assistance identical between comparisons. The [reference oracles](../scripts/reference/README.md) protect numerical fidelity, while [release evidence](../specs/done/help-the-fly-escape/assets/evidence/release-final/README.md) records what was actually exercised in the browser.

Historical experiments are retained in the [research archive](../specs/done/help-the-fly-escape/spikes/README.md). They are evidence to interpret, not a second runtime or a promise of a particular biological response.

## Deploy to Vercel

Vercel’s Git integration builds and deploys pushes to `main` as production. Other branches receive preview deployments. The project stays rooted at the repository root so Bun can resolve workspace packages and Rust can see the shared assets. [vercel.json](../vercel.json) owns the install command, build command, output directory and routing rules.

The cloud build uses the committed graph and manifest, compiles Rust to WebAssembly, and publishes only the game distribution. `wasm-pack` is a pinned build dependency installed with Bun; its trusted install script downloads the native executable. The cloud install step provisions rustup with the compiler and WebAssembly target selected by `rust-toolchain.toml`, since Vercel’s bundled compiler lacks that target. Python and raw connectome downloads are unnecessary for deployment. A failed build leaves the previous production deployment serving.

For an explicit local prebuilt deployment, link the checkout with `vercel link`, then run:

```sh
bun run build:vercel
vercel deploy --prebuilt --prod
```

The packaging step reuses the checked-in route configuration. Existing files resolve directly; diagnostic `/lab/*` routes fall back to the game document. Missing asset URLs remain errors rather than returning HTML. Local project metadata and deployment credentials stay ignored.
