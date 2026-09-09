import { zoomOut } from "./zoom-out.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.ASSET_LAB_URL ?? "http://127.0.0.1:5199";
const output = new URL(process.env.SOLID_OUTPUT ?? "/tmp/fly-solid-prop/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors=[]; page.on("pageerror", e=>errors.push(e.message));
const shot = name => page.screenshot({ path: new URL(`${name}.png`, output).pathname });
try {
 await page.goto(`${base}/?fixture=house`);
 await page.locator('.status').filter({hasText:/triangles/}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#app').dataset.houseReady === 'true');
 await zoomOut(page); await shot('overview');
 const visibility=()=>page.locator('#app').getAttribute('data-house-visibility').then(JSON.parse);
 assert.equal((await visibility()).solidsCutaway,0);
 await page.locator('aside').evaluate(el=>el.scrollTop=0); await shot('controls');
 await page.locator('#probe-solid').click();
 await page.waitForFunction(()=>document.querySelector('#app').dataset.solidProbe);
 await shot('before');
 await page.locator('#solid-progress').fill('1'); await page.locator('#solid-progress').dispatchEvent('input');
 await page.locator('#solid-status').filter({hasText:/Stopped before solid/}).waitFor();
 const blocked=JSON.parse(await page.locator('#app').getAttribute('data-solid-probe'));
 assert.ok(Math.abs(blocked.stopped.x-(blocked.solid.min.x-blocked.radius))<1e-7);
 assert.equal(blocked.lineOfSight,false); await shot('stopped');
 assert.equal((await visibility()).solidsCutaway,1);
 await page.locator('#solid-path').selectOption('detour');
 await page.locator('#solid-status').filter({hasText:/Path clear/}).waitFor();
 const detour=JSON.parse(await page.locator('#app').getAttribute('data-solid-probe'));
 assert.deepEqual(detour.stopped,detour.requested); assert.equal(detour.lineOfSight,true); await shot('detour');
 const resources=()=>page.locator('#app').getAttribute('data-house-resources').then(JSON.parse);
 const before=await resources();
 await page.locator('#part').selectOption('solid');
 for(let i=0;i<4;++i){
  await page.locator('#house-file').setInputFiles([]);
  await page.locator('#house-file').setInputFiles(new URL('../../assets/house/solid.glb',import.meta.url).pathname);
  await page.locator('#house-status').filter({hasText:/solid loaded/}).waitFor();
  await page.evaluate(()=>new Promise(requestAnimationFrame));
 }
 const after=await resources(); assert.equal(after.geometries,before.geometries); assert.equal(after.textures,before.textures);
 assert.deepEqual(errors,[]);
 await writeFile(new URL('report.json',output),JSON.stringify({blocked,detour,before,after,errors},null,2));
}finally{await browser.close();}
