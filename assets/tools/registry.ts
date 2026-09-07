import type { ToolKind } from "../../packages/sim-client/src";
import fruit from "../food/apple/apple.glb?url";
import crumbs from "../food/crumbs.glb?url";
import vinegar from "./vinegar.glb?url";
import fan from "./fan.glb?url";
import lamp from "./lamp.glb?url";
import shade from "./shade.glb?url";
export const placementAssetUrls = { fruit, crumbs, vinegar, fan, lamp, shade } as const satisfies Record<ToolKind, string>;
