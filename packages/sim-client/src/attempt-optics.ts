import type { RetinalConfig, ResolvedSetup, StartAttempt, ToolDef } from "./generated/sim";
import { retinaWorldIdentity, type RetinaWorldDefinition } from "../../game-renderer/src/retina-world";
import { assertRetinalProfile } from "../../game-renderer/src/retina-profile";
import { retinaProfile, RetinaProjection } from "../../game-renderer/src/retina-projection";

export type AttemptWorldAuthoring = Pick<RetinaWorldDefinition, "roomFloors" | "roomDetails" | "lighting">;
async function loadMap(signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const response = await fetch("/brain/retinal-map.json", { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`Retinal map download failed (${response.status})`);
  const text = await response.text();
  signal.throwIfAborted();
  return text;
}

export async function prepareAttemptOptics(input: StartAttempt, authoring: AttemptWorldAuthoring,
  resolved: ResolvedSetup, catalog: ToolDef[], generation: number, signal: AbortSignal) {
  const definition: RetinaWorldDefinition = {
    ...authoring, geometry: input.level.geometry,
    placements: [...resolved.fixedPlacements, ...resolved.state.placements], catalog,
  };
  // Preserve the original exported JSON text: native checks its exact canonical subobjects.
  const mapText = await loadMap(signal);
  const map = JSON.parse(mapText);
  assertRetinalProfile(map.profile);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mapText));
  const mapHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const { profileHash, layoutHash, rigHash, colorModelHash } = map.identities;
  const config: RetinalConfig = {
    clientGeneration: generation, sceneId: await retinaWorldIdentity(definition), mapHash,
    profile: { profileHash, layoutHash, rigHash, colorModelHash, width: retinaProfile.width,
      height: retinaProfile.height, sampleCount: new RetinaProjection(retinaProfile).cells.length },
  };
  return { definition, mapText, config };
}
