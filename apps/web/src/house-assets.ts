import { loadHousePart, type WorldView, type HousePart } from "@fly-escape/game-renderer";
import wallUrl from "../../../assets/house/wall.glb?url";
import floorUrl from "../../../assets/house/floor.glb?url";
import solidUrl from "../../../assets/house/solid.glb?url";

/** Load one kit per view. Replacement owns resources; retired views release late replies. */
export async function loadHouseAssets(view: WorldView, isCurrent: () => boolean) {
  const parts: [HousePart, string][] = [
    ["wall", wallUrl],
    ["floor", floorUrl],
    ["solid", solidUrl],
  ];
  const results = await Promise.allSettled(
    parts.map(async ([part, url]) => {
      const response = await fetch(url);
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
