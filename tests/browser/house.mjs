import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const output = new URL("../../specs/help-the-fly-escape/assets/evidence/10/browser/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "warning" && /WebGL|GL_INVALID/.test(m.text())) errors.push(m.text()); });
const shot = async name => { await page.screenshot({ path: new URL(`${name}.png`, output).pathname }); };
try {
  await page.goto(`${process.env.ASSET_LAB_URL ?? "http://127.0.0.1:5192"}/?fixture=house`);
  await page.locator(".status").filter({ hasText: /triangles/ }).waitFor();
  await page.waitForFunction(() => document.querySelector("#app").dataset.houseReady === "true");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await shot("overview");
  await page.locator("#room").selectOption("5");
  await page.locator("#inspect-room").click();
  await shot("pantry-follow");
  await page.locator("#cutaway").click();
  await page.waitForFunction(() => JSON.parse(document.querySelector("#app").dataset.houseVisibility).hidden > 0);
  await shot("pantry-cutaway");
  for (const [value, name] of [["-1", "before"], ["0", "threshold"], ["1", "after"]]) {
    await page.locator("#doorway").selectOption("2");
    await page.locator("#crossing").fill(value);
    await page.locator("#crossing").dispatchEvent("input");
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await shot(`pantry-${name}`);
  }
  const resources = () => page.locator("#app").getAttribute("data-house-resources").then(JSON.parse);
  const before = await resources();
  for (let i = 0; i < 6; ++i) {
    const part = i % 2 ? "floor" : "wall";
    await page.locator("#part").selectOption(part);
    await page.getByLabel("Replace house part", { exact: true }).setInputFiles(new URL(`../../assets/house/${part}.glb`, import.meta.url).pathname);
    await page.waitForFunction(part => document.querySelector("#house-status").textContent.startsWith(`${part} loaded`), part);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  const after = await resources();
  assert.equal(after.geometries, before.geometries);
  assert.equal(after.textures, before.textures);
  await page.locator("#part").selectOption("wall");
  await page.getByLabel("Replace house part", { exact: true }).setInputFiles([]);
  await page.getByLabel("Replace house part", { exact: true }).setInputFiles(new URL("../../assets/house/floor.glb", import.meta.url).pathname);
  await page.locator("#house-status").filter({ hasText: /Previous part retained/ }).waitFor();
  assert.deepEqual(await resources(), after);
  assert.deepEqual(errors, []);
  await writeFile(new URL("report.json", output), JSON.stringify({ before, after, errors, rejectedWrongBounds: true }, null, 2));
} finally { await browser.close(); }
