import { zoomOut } from "./zoom-out.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const output = process.env.PALETTE_OUTPUT ?? "/tmp/fly-palette-captures";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = { geometryBuffers: {} };
for (const part of ["floor", "wall", "solid"]) {
  const glb = await readFile(new URL(`../../assets/house/${part}.glb`, import.meta.url));
  const binOffset = 20 + glb.readUInt32LE(12);
  report.geometryBuffers[part] = createHash("sha256")
    .update(glb.subarray(binOffset + 8))
    .digest("hex");
}
const shot = async (name) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.screenshot({ path: `${output}/${name}.png` });
};
try {
  await page.addInitScript(() => {
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) =>
      array instanceof BigUint64Array ? array.fill(42n) : random(array);
  });
  await page.goto(`${process.env.BRAIN_URL ?? "http://127.0.0.1:5173"}/lab/setup`);
  await page.waitForFunction(
    () => document.querySelector(".run-setup") && !document.querySelector(".run-setup").disabled,
  );
  await page.waitForTimeout(300);
  await shot("production-setup-overview");
  await page.getByRole("button", { name: "Run · release flies" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForFunction(
    () => {
      const report = document.querySelector('[data-testid="playback-report"]');
      return report && JSON.parse(report.textContent).complete;
    },
    null,
    { timeout: 180000 },
  );
  await page.getByTestId("playback-seek").evaluate((input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "100");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="playback-lab"]').dataset.cursorTick) === 100,
  );
  await shot("production-follow");
  report.production = JSON.parse(await page.getByTestId("playback-report").textContent());
  await zoomOut(page);
  await shot("production-overview");
  await page.goto(`${process.env.ASSET_LAB_URL ?? "http://127.0.0.1:5174"}/?fixture=house`);
  await page.waitForFunction(() => document.querySelector("#app").dataset.houseReady === "true");
  await page.locator(".status").filter({ hasText: "Model loaded" }).waitFor();
  await shot("authored-follow");
  await zoomOut(page);
  await shot("authored-overview");
  report.authored = JSON.parse(await page.locator("#app").getAttribute("data-house-resources"));
  if (await page.locator("#probe-solid").count()) {
    await page.locator("#probe-solid").click();
    await page.locator("#solid-progress").fill("1");
    await page.locator("#solid-progress").dispatchEvent("input");
    await shot("authored-solid");
  }
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
