import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const output = process.env.SCIENCE_OUTPUT
  ? pathToFileURL(process.env.SCIENCE_OUTPUT + "/")
  : new URL("/tmp/fly-science-panel/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
// One WebGL context may back the world and one the brain; roster thumbnails share a renderer
// that never enters the document, so no entry may hold a context of its own.
const documentContexts = () =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("canvas")].filter(
        (canvas) => canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
      ).length,
  );
try {
  await page.goto(`${base}/lab/playback`);
  await page.waitForSelector('[data-playback-state="playing"]', { timeout: 60000 });
  await page.waitForFunction(
    () => Number(document.querySelector("[data-cursor-tick]").dataset.cursorTick) >= 30,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForSelector('[data-playback-state="paused"]');
  assert.equal(await page.locator(".fly-roster .fly-card").count(), 20);
  assert.deepEqual(
    await page
      .locator(".fly-roster .fly-card")
      .evaluateAll((entries) => entries.map((entry) => Number(entry.dataset.flyId))),
    Array.from({ length: 20 }, (_, id) => id),
  );
  assert.equal(await page.locator(".fly-roster canvas.fly-preview").count(), 20);
  assert.equal(await page.locator(".science-details").count(), 0);
  await page.getByTestId("fly-card-0").click();
  assert.equal(await page.locator(".science-details").count(), 1);
  assert.equal(await page.locator(".group-network").count(), 1);
  assert.equal(await page.locator(".science-trace").count(), 2);
  assert.equal(await page.locator(".science-details select").count(), 0);
  assert.equal(await page.locator(".brain-view canvas").count(), 1);
  const contexts = await documentContexts();
  assert.equal(contexts, 2, "world and brain hold the only WebGL contexts in the document");
  const details = page.locator(".science-details");
  const tick = await details.getAttribute("data-sample-tick");
  assert.ok(
    (
      await page
        .locator(".science-trace svg")
        .evaluateAll((plots) => plots.map((plot) => plot.dataset.endTick))
    ).every((end) => end === tick),
  );
  await page.screenshot({ path: new URL("panel.png", output).pathname });
  await page.locator(".fly-roster").screenshot({ path: new URL("roster.png", output).pathname });
  // The details section is taller than the viewport; capture it where the reader meets it.
  await details.scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL("details.png", output).pathname });
  await page.locator(".science-panel").evaluate((panel) => panel.scrollIntoView());
  assert.equal(await details.getAttribute("data-fly-id"), "0");
  const last = page.getByRole("button", { name: "Select fly 20", exact: true });
  await last.focus();
  await last.press("Enter");
  assert.equal(await last.getAttribute("aria-pressed"), "true");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="selected-fly"]').dataset.flyId === "19",
  );
  assert.equal(await page.locator(".fly-card[aria-pressed='true']").count(), 1);
  assert.equal(await page.locator(".science-details").count(), 1);
  // Choosing another entry moves the same single details section rather than adding one.
  await page.getByRole("button", { name: "Select fly 7", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="selected-fly"]').dataset.flyId === "6",
  );
  assert.equal(
    await page.getByRole("button", { name: "Select fly 7", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await last.getAttribute("aria-pressed"), "false");
  await last.focus();
  await last.press("Enter");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="selected-fly"]').dataset.flyId === "19",
  );
  await page
    .locator(".science-details .science-legend")
    .getByRole("button", { name: "Vision L", exact: true })
    .click();
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
  assert.equal(await documentContexts(), 2);
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("checks.json", output),
    JSON.stringify(
      {
        browser: browser.version(),
        rosterEntries: 20,
        previews: 20,
        detailsSections: 1,
        brainViews: 1,
        plots: 2,
        documentWebglContexts: contexts,
        sampleTick: tick,
        keyboardAndHoverExplanation: true,
        rosterAndWorldSelectionSync: true,
        viewportBounds: [box, narrowBox],
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Compact roster, single details section, shared preview context, selection sync and viewport-bounded explanations passed.",
  );
} finally {
  await browser.close();
}
