import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EyePanels } from "./eye-panels";
import identities from "../../../packages/game-renderer/src/retina-map-identities.json";
import type { FrameArchive, RetinalConfig } from "@fly-escape/sim-client";
const config: RetinalConfig = {
  clientGeneration: 7, sceneId: "fixture", mapHash: "e".repeat(64),
  profile: {profileHash:identities.profileHash,layoutHash:identities.layoutHash,rigHash:identities.rigHash,colorModelHash:identities.colorModelHash,width:128,height:128,sampleCount:721},
};
const sample={pose:{flyId:5,position:[0,0,0] as [number,number,number],rotation:[0,0,0,1] as [number,number,number,number]},rgb:new Uint8Array(721*6)};
const archive = {hasRetina: (tick: number, id: number) => tick === 3 && id === 5, retina: () => sample} as unknown as FrameArchive;
test("recorded black eyes remain present while absent input has an explicit empty state",()=>{
 const black=renderToStaticMarkup(<EyePanels flyId={5} tick={3} config={config} expectedConfig={config} archive={archive}/>);
 expect(black.match(/<canvas/g)).toHaveLength(2);
 expect(black).toContain("Left eye");expect(black).toContain("Right eye");expect(black).toContain("0.3");
 const absent=renderToStaticMarkup(<EyePanels flyId={5} tick={4} config={config} expectedConfig={config} archive={archive}/>);
 expect(absent).not.toContain("<canvas");expect(absent).toContain("No eye input was recorded at this time.");
});

test("a mismatched scene, eye layout or selected fly cannot display another input",()=>{
 for(const expected of [{...config,sceneId:"another-scene"},{...config,profile:{...config.profile,layoutHash:"f".repeat(64)}}]) {
  const html=renderToStaticMarkup(<EyePanels flyId={5} tick={3} config={config} expectedConfig={expected} archive={archive}/>);
  expect(html).not.toContain("<canvas");expect(html).toContain("do not match");
 }
 const wrongFly=renderToStaticMarkup(<EyePanels flyId={6} tick={3} config={config} expectedConfig={config} archive={archive}/>);
 expect(wrongFly).not.toContain("<canvas");expect(wrongFly).toContain("No eye input was recorded");
});
