import { AttemptClient } from "@fly-escape/sim-client";
import { loadPlacementModel, type PlacementKind, type WorldView } from "@fly-escape/game-renderer";
import { placementAssetUrls } from "../../../assets/tools/registry";

export async function placementWorkbench(view: WorldView, panel: HTMLElement) {
  panel.insertAdjacentHTML(
    "beforeend",
    `<h3>Floor tool assets</h3><label>Tool shape <select id="tool-kind"><option value="">None</option><option value="crumbs">Scent crumbs · odor only</option><option value="vinegar">Vinegar · repellent</option><option value="fan">Fan · directional wind</option><option value="lamp">Lamp · visual cue</option><option value="shade">Shade · visual cue</option></select></label><label>Diagnostic position <select id="tool-position"><option value="0">Under fly</option><option value="0.5" selected>Beside fly</option></select></label><label>Tool heading <input id="tool-heading" type="range" min="0" max="6.283185307179586" step="0.01" value="0"></label><label>Replace tool GLB <input id="tool-file" type="file" accept=".glb"></label><p id="tool-status" role="status">Loading tool assets…</p><p>Inspect edible fruit in the <a href="?fixture=contact">surface-contact workbench</a>. These floor cues use catalog-scaled X/Z and ≤0.005m relief. Food uses recorded body contact; shade marks a visual cue, not a physical canopy.</p>`,
  );
  const status = panel.querySelector<HTMLElement>("#tool-status")!;
  const control = panel.querySelector<HTMLSelectElement>("#tool-kind")!;
  const client = new AttemptClient(() => {});
  let live = true;
  window.addEventListener(
    "pagehide",
    () => {
      live = false;
      client.dispose();
    },
    { once: true },
  );
  const counts = new Map<PlacementKind, number>();
  try {
    const { catalog } = await client.setup({ type: "fixture" });
    client.dispose();
    const place = () => {
      const kind = control.value as PlacementKind | "";
      view.setPlacements(
        kind
          ? [
              {
                id: 1,
                kind,
                position: {
                  x: Number(panel.querySelector<HTMLSelectElement>("#tool-position")!.value),
                  z: 0,
                },
                heading: Number(panel.querySelector<HTMLInputElement>("#tool-heading")!.value),
              },
            ]
          : [],
        catalog,
      );
      status.textContent = kind
        ? `${kind} · ${counts.get(kind) ?? 0} triangles · ≤0.005m relief`
        : `${counts.size} tool assets ready`;
    };
    const replace = async (kind: PlacementKind, bytes: Promise<ArrayBuffer>) => {
      const model = await loadPlacementModel(await bytes, kind);
      if (!live) {
        model.dispose();
        return;
      }
      view.setPlacementModel(kind, model.root);
      counts.set(kind, model.triangles);
    };
    const results = await Promise.allSettled(
      Object.entries(placementAssetUrls).filter(([kind]) => kind !== "fruit").map(([kind, url]) =>
        replace(
          kind as PlacementKind,
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`${kind} load failed`);
            return r.arrayBuffer();
          }),
        ),
      ),
    );
    const failed = results.find((r) => r.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    if (!live) return;
    place();
    control.addEventListener("change", place);
    panel.querySelector("#tool-position")!.addEventListener("change", place);
    panel.querySelector("#tool-heading")!.addEventListener("input", place);
    panel.querySelector<HTMLInputElement>("#tool-file")!.addEventListener("change", (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      if (file && control.value)
        void replace(control.value as PlacementKind, file.arrayBuffer())
          .then(place)
          .catch((error) => {
            if (live) status.textContent = String(error);
          });
    });
  } catch (error) {
    client.dispose();
    if (live) status.textContent = String(error);
  }
}
