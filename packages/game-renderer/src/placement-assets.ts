import { loadPlacementModel, type PlacementModels } from "./placement-models";
import { placementAssetUrls } from "../../../assets/tools/registry";

/** Install a complete template set; stale or failed loads release every unaccepted result. */
export async function loadPlacementAssets(models: PlacementModels, isCurrent: () => boolean, signal?: AbortSignal): Promise<void> {
  const results = await Promise.allSettled(
    Object.entries(placementAssetUrls).map(async ([kind, url]) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`${kind} model request failed (${response.status})`);
      const key = kind as keyof typeof placementAssetUrls;
      return { kind: key, model: await loadPlacementModel(await response.arrayBuffer(), key) };
    }),
  );
  const failure = results.find(result => result.status === "rejected");
  if (failure || !isCurrent()) {
    for (const result of results) if (result.status === "fulfilled") result.value.model.dispose();
    if (failure?.status === "rejected") throw failure.reason;
    return;
  }
  for (const result of results) if (result.status === "fulfilled") models.replace(result.value.kind, result.value.model.root);
}
