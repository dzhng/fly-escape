import { AttemptClient } from "@fly-escape/sim-client";
import {
  loadFoodModel,
  type FoodKind,
  type WorldView,
} from "@fly-escape/game-renderer";
import fruitUrl from "../../../assets/food/fruit.glb?url";
import crumbsUrl from "../../../assets/food/crumbs.glb?url";

export async function foodWorkbench(view: WorldView, panel: HTMLElement) {
  panel.insertAdjacentHTML(
    "beforeend",
    `<h3>Floor food assets</h3><label>Food shape <select id="food-kind"><option value="">None</option><option value="fruit">Fruit · edible</option><option value="crumbs">Scent crumbs · odor only</option></select></label><label>Replace food GLB <input id="food-file" type="file" accept=".glb"></label><p id="food-status" role="status">Loading food assets…</p><p>Native radius ≤1, Y=0…0.005. Placement scales X/Z from the core catalog. Near-flush food is not solid furniture; feeding uses recorded body contact, not exact mouth intersection.</p>`,
  );
  const status = panel.querySelector<HTMLElement>("#food-status")!;
  const control = panel.querySelector<HTMLSelectElement>("#food-kind")!;
  const client = new AttemptClient(() => {});
  try {
    const { catalog } = await client.setup({ type: "fixture" });
    client.dispose();
    const place = () => {
      const kind = control.value as FoodKind | "";
      view.setPlacements(
        kind ? [{ id: 1, kind, position: { x: 0, z: 0 }, heading: 0 }] : [],
        catalog,
      );
    };
    const replace = async (kind: FoodKind, bytes: Promise<ArrayBuffer>) => {
      try {
        const model = await loadFoodModel(await bytes);
        view.setFoodModel(kind, model.root);
        place();
        status.textContent = `${kind} · ${model.triangles} triangles · ≤0.005 relief`;
      } catch (error) {
        status.textContent = String(error);
      }
    };
    await Promise.all(
      (
        [
          ["fruit", fruitUrl],
          ["crumbs", crumbsUrl],
        ] as const
      ).map(([kind, url]) =>
        replace(
          kind,
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`${kind} load failed`);
            return r.arrayBuffer();
          }),
        ),
      ),
    );
    control.addEventListener("change", place);
    panel
      .querySelector<HTMLInputElement>("#food-file")!
      .addEventListener("change", (event) => {
        const file = (event.currentTarget as HTMLInputElement).files?.[0];
        if (file && control.value)
          void replace(control.value as FoodKind, file.arrayBuffer());
      });
  } catch (error) {
    client.dispose();
    status.textContent = String(error);
  }
}
