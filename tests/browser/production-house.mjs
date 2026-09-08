import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const url = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const pattern = /\/assets\/house\/(wall|floor|solid)\.glb$/;
let fail = true;
let release;
let gate = Promise.resolve();
const loaded = [];
await page.route(pattern, async (route) => {
  loaded.push(route.request().url().match(pattern)[1]);
  await gate;
  if (fail && route.request().url().includes("solid.glb"))
    await route.fulfill({ status: 503, body: "Unavailable" });
  else await route.continue();
});
try {
  await page.goto(url + "/lab/setup");
  await page.getByRole("alert").filter({ hasText: "House solid request failed (503)" }).waitFor();
  assert.equal(await page.locator(".run-setup").isDisabled(), true);
  assert.deepEqual([...new Set(loaded)].sort(), ["floor", "solid", "wall"]);
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
  release();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="playback-lab"]')?.dataset.worldState === "ready",
  );
  assert.equal(loaded.length, 9);
  await page.getByRole("button", { name: /Cancel attempt|Retry — edit setup/ }).click();
  await page.getByRole("button", {name: "Leave attempt", exact: true}).click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === "ready",
  );
  assert.equal(loaded.length, 12);
  gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.locator(".run-setup").click();
  await page.getByText("Loading world assets…", { exact: true }).waitFor();
  await page.getByRole("button", { name: /Cancel attempt|Retry — edit setup/ }).click();
  await page.getByRole("button", {name: "Leave attempt", exact: true}).click();
  release();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === "ready",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      houseRequests: loaded,
      failureExplicit: true,
      loadingBlocksRun: true,
      retryReady: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
