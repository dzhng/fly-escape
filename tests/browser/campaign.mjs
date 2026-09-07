import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5215";
const out = "specs/help-the-fly-escape/assets/evidence/16/progression";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.liveWorkers = 0;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        window.liveWorkers++;
        this.retired = false;
      }
      terminate() {
        if (!this.retired) {
          this.retired = true;
          window.liveWorkers--;
        }
        super.terminate();
      }
    };
  });
  await page.route("**/campaign-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<div id="root"></div><script type="module" src="/@fs${fileURLToPath(new URL("./campaign-fixture.tsx", import.meta.url))}"></script>`,
    }),
  );
  const ready = () =>
    page.waitForFunction(
      () => document.querySelector('[data-testid="setup-game"]')?.dataset.worldState === "ready",
    );
  await page.goto(base + "/campaign-check");
  await ready();
  assert.equal(await page.evaluate(() => window.liveWorkers), 1);
  const nav = page.getByRole("navigation", { name: "Campaign levels" });
  assert.equal(await nav.getByRole("button", { name: /Second/ }).isDisabled(), true);
  assert.equal(await page.locator(".tool-palette button").count(), 1);
  await page.mouse.move(680, 520);
  await page.getByTestId("placement-feedback").filter({ hasText: "Valid placement" }).waitFor();
  await page.mouse.click(680, 520);
  await page.getByRole("button", { name: "Remove Fruit 1", exact: true }).waitFor();
  assert.equal(await page.locator(".tool-palette button").isDisabled(), true);
  await page.screenshot({ path: out + "/first-exhausted.png" });
  await page.reload();
  await ready();
  assert.equal(await page.evaluate(() => window.liveWorkers), 1);
  await page.getByRole("button", { name: "Remove Fruit 1", exact: true }).waitFor();
  // Persisted completion is an explicit fixture input, not a simulated success claim.
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("fly-escape-progress"));
    p.bestStars["test-campaign-0"] = 1;
    localStorage.setItem("fly-escape-progress", JSON.stringify(p));
  });
  await page.reload();
  await ready();
  assert.equal(await page.evaluate(() => window.liveWorkers), 1);
  await nav.getByRole("button", { name: /Second/ }).click();
  await ready();
  assert.equal(await page.evaluate(() => window.liveWorkers), 1);
  await page.getByRole("heading", { name: "Second", exact: true }).waitFor();
  assert.match(await page.locator(".tool-palette").innerText(), /Scent crumbs/);
  assert.equal(await page.locator(".placed-tools button").count(), 0);
  assert.equal(await nav.getByRole("button", { name: /Third/ }).isDisabled(), true);
  await page.screenshot({ path: out + "/second-unlocked.png" });
  await page.getByRole("button", { name: "Run · release flies", exact: true }).click();
  await page.getByTestId("playback-lab").waitFor();
  assert.equal(await nav.getByRole("button", { name: /First/ }).isDisabled(), true);
  await page.getByRole("button", { name: /Retry — edit setup/ }).waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: /Retry — edit setup/ }).click();
  await ready();
  assert.equal(await page.evaluate(() => window.liveWorkers), 1);
  assert.equal(await nav.getByRole("button", { name: /Third/ }).isDisabled(), true);
  await nav.getByRole("button", { name: /First/ }).click();
  await ready();
  assert.equal(await page.evaluate(() => window.liveWorkers), 1);
  await page.getByRole("button", { name: "Remove Fruit 1", exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset progress and setup", exact: true }).click();
  await page.waitForFunction(
    () =>
      Object.keys(JSON.parse(localStorage.getItem("fly-escape-progress")).bestStars).length === 0,
  );
  assert.equal(await nav.getByRole("button", { name: /Second/ }).isDisabled(), true);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("denied");
    };
  });
  await page.reload();
  await ready();
  assert.equal(await page.evaluate(() => window.liveWorkers), 1);
  await page
    .getByText(/could not save|cannot save|couldn.t save|storage/i)
    .first()
    .waitFor();
  assert.equal(await page.locator(".run-setup").isDisabled(), false);
  await page.screenshot({ path: out + "/storage-denied.png" });
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      {
        errors,
        locked: true,
        perLevelRestore: true,
        zeroInventoryHidden: true,
        exhaustedRetained: true,
        actualZeroStarAttempt: true,
        unlockInput: "persisted one-star fixture",
        deniedStoragePlayable: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
