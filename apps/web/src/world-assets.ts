import { loadFlyModel, loadWorldSceneAssets, type RoomDetail, type WorldView } from "@fly-escape/game-renderer";
import flyModelUrl from "../../../assets/fly/fly.glb?url";

/** Required presentation resources share one gate; each loader releases stale results. */
export async function loadWorldAssets(view: WorldView, isCurrent: () => boolean, details: readonly RoomDetail[] = []): Promise<void> {
  await Promise.all([
    loadWorldSceneAssets(view.world, details, isCurrent).then(() => {
      if (isCurrent()) view.refreshWorldBounds();
    }),
    (async () => {
      const response = await fetch(flyModelUrl);
      if (!response.ok) throw new Error(`Fly model request failed (${response.status})`);
      const model = await loadFlyModel(await response.arrayBuffer());
      if (isCurrent()) view.setFlyModel(model);
      else model.dispose();
    })(),
  ]);
}
