import {
  loadFoodModel,
  type FoodKind,
  type WorldView,
} from "@fly-escape/game-renderer";
import fruitUrl from "../../../assets/food/fruit.glb?url";
import crumbsUrl from "../../../assets/food/crumbs.glb?url";

/** The view owns accepted resources; late responses dispose without touching a replaced attempt. */
export async function loadFoodAssets(
  view: WorldView,
  isCurrent: () => boolean,
): Promise<void> {
  await Promise.all(
    (
      [
        ["fruit", fruitUrl],
        ["crumbs", crumbsUrl],
      ] as const
    ).map(async ([kind, url]: readonly [FoodKind, string]) => {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`${kind} model request failed (${response.status})`);
      const model = await loadFoodModel(await response.arrayBuffer());
      if (isCurrent()) view.setFoodModel(kind, model.root);
      else model.dispose();
    }),
  );
}
