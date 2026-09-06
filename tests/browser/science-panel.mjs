import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const output = process.env.SCIENCE_OUTPUT
  ? pathToFileURL(process.env.SCIENCE_OUTPUT + "/")
  : new URL("../../specs/help-the-fly-escape/assets/evidence/13/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(`${base}/lab/playback`);
  await page.waitForSelector('[data-playback-state="playing"]', { timeout: 60000 });
  await page.waitForFunction(
    () => Number(document.querySelector("[data-cursor-tick]").dataset.cursorTick) >= 30,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForSelector('[data-playback-state="paused"]');
  assert.equal(await page.locator(".science-card").count(), 20);
  assert.deepEqual(
    await page
      .locator(".science-card")
      .evaluateAll((cards) => cards.map((card) => Number(card.dataset.flyId))),
    Array.from({ length: 20 }, (_, id) => id),
  );
  assert.equal(await page.locator(".group-network").count(), 20);
  assert.equal(await page.locator(".science-trace").count(), 40);
  const tick = await page.locator(".science-card").first().getAttribute("data-sample-tick");
  assert.ok(
    (
      await page
        .locator(".science-trace svg")
        .evaluateAll((plots) => plots.map((plot) => plot.dataset.endTick))
    ).every((end) => end === tick),
  );
  await page.screenshot({ path: new URL("panel.png", output).pathname });
  await page
    .locator(".science-card")
    .first()
    .screenshot({ path: new URL("card.png", output).pathname });
  const last = page.getByRole("button", { name: "Select fly 20", exact: true });
  await last.focus();
  await last.press("Enter");
  assert.equal(await last.getAttribute("aria-pressed"), "true");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="selected-fly"]').dataset.flyId === "19",
  );
  await page.getByLabel("Neural group for fly 20", { exact: true }).selectOption("visionL");
  await page.screenshot({ path: new URL("last-card.png", output).pathname });
  const explain = page.getByRole("button", { name: "Explain Vision · left", exact: true });
  await explain.focus();
  const tooltip = page.getByRole("region", { name: "Vision · left explained", exact: true });
  await tooltip.waitFor();
  const box = await tooltip.boundingBox();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 1440 && box.y + box.height <= 1000);
  await page.screenshot({ path: new URL("tooltip.png", output).pathname });
  await tooltip.screenshot({ path: new URL("tooltip-crop.png", output).pathname });
  await explain.press("Escape");
  await tooltip.waitFor({ state: "hidden" });
  await explain.hover();
  await tooltip.waitFor();
  await tooltip.hover();
  await page.waitForTimeout(400);
  assert.ok(
    await tooltip.isVisible(),
    "Hover explanation remains available to read and follow sources",
  );
  await page.mouse.move(0, 0);
  await tooltip.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 820, height: 900 });
  await last.focus();
  await last.press("Enter");
  await explain.focus();
  await tooltip.waitFor();
  const narrowBox = await tooltip.boundingBox();
  assert.ok(
    narrowBox.x >= 0 &&
      narrowBox.x + narrowBox.width <= 820 &&
      narrowBox.y + narrowBox.height <= 900,
  );
  await page.screenshot({ path: new URL("narrow-tooltip.png", output).pathname });
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("checks.json", output),
    JSON.stringify(
      {
        browser: browser.version(),
        cards: 20,
        plots: 40,
        sampleTick: tick,
        keyboardAndHoverExplanation: true,
        lastCardSelection: true,
        viewportBounds: [box, narrowBox],
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "All-fly diagrams, traces, shared timestamps, keyboard selection and viewport-bounded explanations passed.",
  );
} finally {
  await browser.close();
}
