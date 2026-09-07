import assert from "node:assert/strict";
import { chromium } from "playwright";
// Run against Vite dev: production may inline small GLBs as data URLs.
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const url = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const results = [];
try {
  for (const [asset, failure] of [
    ["food/apple/apple", "fruit model request failed (503)"],
    ["food/crumbs", "crumbs model request failed (503)"],
    ["fly/fly", "Fly model request failed (503)"],
    ...["vinegar", "fan", "lamp", "shade"].map((kind) => [
      `tools/${kind}`,
      `${kind} model request failed (503)`,
    ]),
  ]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let fail = true;
    let release;
    let gate = Promise.resolve();
    await page.route(`**/assets/${asset}.glb`, async (route) => {
      await gate;
      if (fail) await route.fulfill({ status: 503, body: "Unavailable" });
      else await route.continue();
    });
    await page.goto(url);
    await page.getByRole("alert").filter({ hasText: failure }).waitFor();
    assert.equal(await page.locator(".run-setup").isDisabled(), true);
    fail = false;
    gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.reload();
    await page.getByText("Loading world assets…", { exact: true }).waitFor();
    assert.equal(await page.locator(".run-setup").isDisabled(), true);
    release();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === "ready",
    );
    gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.locator(".run-setup").click();
    await page.getByText("Loading world assets…", { exact: true }).waitFor();
    await page.waitForTimeout(1200);
    assert.equal(Number(await page.getByRole("slider", { name: "Playback time" }).inputValue()), 0);
    release();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="playback-lab"]')?.dataset.worldState === "ready",
    );
    await page.getByRole("button", { name: /Cancel attempt|Retry — edit setup/ }).click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === "ready",
    );
    fail = true;
    await page.locator(".run-setup").click();
    await page.getByRole("alert").filter({ hasText: failure }).waitFor();
    assert.equal(
      await page.locator('[data-testid="playback-lab"]').getAttribute("data-world-state"),
      "error",
    );
    assert.deepEqual(errors, []);
    results.push({
      asset,
      failureBlocksRun: true,
      delayBlocksRun: true,
      playbackReady: true,
      delayedCursorRemainsZero: true,
      playbackFailureExplicit: true,
      errors,
    });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
