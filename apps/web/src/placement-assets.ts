import { loadPlacementModel, type WorldView } from "@fly-escape/game-renderer";
import { placementAssetUrls } from "../../../assets/tools/registry";

/** The view owns accepted resources; retired views release late replies. */
export async function loadPlacementAssets(
  view: WorldView,
  isCurrent: () => boolean,
): Promise<void> {
  await Promise.all(
    Object.entries(placementAssetUrls).map(async ([kind, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${kind} model request failed (${response.status})`);
      const model = await loadPlacementModel(await response.arrayBuffer());
      if (isCurrent()) view.setPlacementModel(kind as keyof typeof placementAssetUrls, model.root);
      else model.dispose();
    }),
  );
}
