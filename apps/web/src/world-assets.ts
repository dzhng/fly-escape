import { loadFlyModel, loadHouseAssets, type WorldView } from "@fly-escape/game-renderer";
import flyModelUrl from "../../../assets/fly/fly.glb?url";
import { loadPlacementAssets } from "./placement-assets";

/** Required presentation resources share one gate; each loader releases stale results. */
export async function loadWorldAssets(view: WorldView, isCurrent: () => boolean): Promise<void> {
  await Promise.all([
    loadHouseAssets(view, isCurrent),
    loadPlacementAssets(view, isCurrent),
    (async () => {
      const response = await fetch(flyModelUrl);
      if (!response.ok) throw new Error(`Fly model request failed (${response.status})`);
      const model = await loadFlyModel(await response.arrayBuffer());
      if (isCurrent()) view.setFlyModel(model);
      else model.dispose();
    })(),
  ]);
}
