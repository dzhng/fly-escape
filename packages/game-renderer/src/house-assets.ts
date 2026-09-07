import { loadHousePart, type HouseAsset } from "./house";
import type { WorldView } from "./index";
import wallUrl from "../../../assets/house/wall.glb?url";
import tileFloorUrl from "../../../assets/house/tile-floor/tile-floor.glb?url";
import floorUrl from "../../../assets/house/floor.glb?url";
import solidUrl from "../../../assets/house/solid.glb?url";
import cabinetUrl from "../../../assets/house/cabinet/cabinet.glb?url";
import deskUrl from "../../../assets/house/desk/desk.glb?url";
import chairUrl from "../../../assets/house/chair/chair.glb?url";
import kitchenUrl from "../../../assets/house/kitchen/kitchen.glb?url";
import bedUrl from "../../../assets/house/bed/bed.glb?url";
import sofaUrl from "../../../assets/house/sofa/sofa.glb?url";

const urls: Record<HouseAsset, string> = { wall: wallUrl, floor: floorUrl, tileFloor: tileFloorUrl, solid: solidUrl, cabinet: cabinetUrl, sofa: sofaUrl, desk: deskUrl, chair: chairUrl, bed: bedUrl, kitchen: kitchenUrl };

/** Load one kit per view. Replacement owns resources; retired views release late replies. */
export async function loadHouseAssets(view: WorldView, isCurrent: () => boolean, parts: readonly HouseAsset[] = view.houseAssetKeys) {
  const results = await Promise.allSettled(
    parts.map(async (part) => {
      const response = await fetch(urls[part]);
      if (!response.ok) throw new Error(`House ${part} request failed (${response.status})`);
      return { part, model: await loadHousePart(await response.arrayBuffer(), part) };
    }),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure || !isCurrent()) {
    for (const result of results) if (result.status === "fulfilled") result.value.model.dispose();
    if (failure?.status === "rejected") throw failure.reason;
    return;
  }
  for (const result of results) {
    if (result.status === "fulfilled")
      view.setHousePart(result.value.part, result.value.model.root);
  }
}
