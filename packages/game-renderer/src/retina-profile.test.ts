import { expect, test } from "bun:test";
import { assertRetinalProfile, retinalProfileSemantic } from "./retina-profile";
import map from "../../../data/processed/brain/retinal-map.json";

test("installed optics match the reviewed map without trusting its declared hashes", () => {
  expect(() => assertRetinalProfile(map.profile)).not.toThrow();
  const swapped = structuredClone(map.profile);
  [swapped.layout.cells[0], swapped.layout.cells[1]] = [swapped.layout.cells[1], swapped.layout.cells[0]];
  expect(() => assertRetinalProfile(swapped)).toThrow("installed optical profile");
  const exposed = retinalProfileSemantic();
  exposed.photometry.exposure = 2;
  expect(() => assertRetinalProfile(exposed)).toThrow("installed optical profile");
  expect(() => assertRetinalProfile(retinalProfileSemantic())).not.toThrow();
});
