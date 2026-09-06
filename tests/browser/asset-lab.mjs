import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
const base = process.env.ASSET_LAB_URL ?? "http://127.0.0.1:5187";
const output = process.env.ASSET_LAB_OUTPUT
  ? pathToFileURL(process.env.ASSET_LAB_OUTPUT + "/")
  : new URL("../../specs/help-the-fly-escape/assets/evidence/07/browser/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const loaded = () =>
  page
    .getByRole("status")
    .filter({ hasText: /triangles/ })
    .waitFor();
const resources = () => page.locator("#app").getAttribute("data-resources").then(JSON.parse);
const shot = (name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
try {
  await page.goto(base);
  await loaded();
  const initial = await resources();
  assert.ok(initial.geometries > 0);
  await shot("follow");
  await page.getByRole("button", { name: "Extra close", exact: true }).click();
  await shot("close");
  await page.getByRole("button", { name: "Turn 90°", exact: true }).click();
  await shot("turned");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await shot("overview");
  const input = page.getByLabel("Replace fly model");
  await input.setInputFiles({
    name: "invalid.glb",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from("invalid model"),
  });
  await page
    .getByRole("status")
    .filter({ hasText: /Could not load model/ })
    .waitFor();
  await shot("invalid-replacement");
  const replacements = [];
  for (let i = 0; i < 5; i++) {
    await input.setInputFiles(fileURLToPath(new URL("../../assets/fly/fly.glb", import.meta.url)));
    await loaded();
    replacements.push(await resources());
  }
  for (const value of replacements) {
    assert.equal(
      value.geometries,
      initial.geometries,
      "Replacing a model must release old GPU geometry",
    );
    assert.equal(
      value.textures,
      initial.textures,
      "Replacing a model must release old textures and skeleton storage",
    );
  }
  await shot("replaced");
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("checks.json", output),
    JSON.stringify({ browser: browser.version(), initial, replacements, errors }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
