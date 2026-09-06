# Fly model workbench

Run `bun run dev:assets` from the repository root. The workbench loads the same GLB and renderer used by playback, so framing, picking and replacement checks exercise the production path. A local replacement changes only this open workbench; it does not overwrite the authored asset.

The [asset contract](../../specs/help-the-fly-escape/CONTRACTS.md#selection-camera-and-assets) defines orientation, scale and resource budgets. The loader rejects ungrounded, off-origin or oversized models rather than silently rescaling them. After replacement, the view owns model resources; instances share geometry and materials while retaining independent skeletons. A failed or superseded load cannot replace the visible model.

Editable source and export scripts live in [assets/fly](../../assets/fly). Metadata prose must avoid glTF loader-reserved fields: for example, Three.js interprets `extras.pivot` as a numeric vector, so human descriptions need a distinct name. Blender round-trip alone cannot verify the browser consumer.

Animation uses explicit clip time through the same instance mixers as gameplay. Pausing or seeking changes no simulation state. Static mode restores the bind pose; replacement files without clips can still be inspected. Clip cadence is stylized, not a measurement of biological wing frequency.

The `?fixture=house` view inspects the [shared house geometry](../../assets/house/five-rooms.json). Walls are segments with gaps already present; the renderer never infers a second layout. Room and doorway controls provide diagnostic poses, not simulated decisions. Local wall/floor/solid replacement preserves the kit bounds and pivot, changes only the open workbench, and releases the previous shared resources. Geometry review remains separate from palette and lighting acceptance; solid props use the same authoritative footprints for collision and rendering.
