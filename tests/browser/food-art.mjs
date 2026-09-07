import { zoomOut } from "./zoom-out.mjs";
import { chromium } from "playwright";
import { mkdir, writeFile, realpath } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5209";
const output =
  process.env.FOOD_EVIDENCE ??
  "specs/help-the-fly-escape/assets/evidence/14/food/candidate";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) =>
      a instanceof BigUint64Array && a.length === 1
        ? ((a[0] = 42n), a)
        : random(a);
  });
  await page.goto(base + "/lab/setup");
  await page
    .getByRole("button", { name: "Release the flies", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".run-setup").disabled,
  );
  await page.mouse.move(680, 520);
  await page
    .getByTestId("placement-feedback")
    .filter({ hasText: "Valid placement" })
    .waitFor();
  await page.screenshot({ path: output + "/setup-ghost.png" });
  await page.mouse.click(680, 520);
  await page
    .getByRole("button", { name: "Remove Fruit 1", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Scent crumbs.*left/ }).click();
  await page.mouse.move(760, 600);
  await page
    .getByTestId("placement-feedback")
    .filter({ hasText: "Valid placement" })
    .waitFor();
  await page.mouse.click(760, 600);
  await page.mouse.move(1430, 20);
  await page.screenshot({ path: output + "/setup-placed.png" });
  await page
    .getByRole("button", { name: "Release the flies", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector('[data-testid="playback-lab"]')?.dataset
          .computedTick,
      ) >= 55,
    null,
    { timeout: 90000 },
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await zoomOut(page);
  await page.getByLabel("Playback time", { exact: true }).evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, "50");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector('[data-testid="playback-lab"]').dataset
          .cursorTick,
      ) === 50,
  );
  await page.mouse.move(1430, 20);
  await page.screenshot({ path: output + "/playback-placed.png" });
  const report = JSON.parse(
    await page.getByTestId("playback-report").textContent(),
  );
  assert.equal(report.spec.placements.length, 2);
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/report.json",
    JSON.stringify(
      { spec: report.spec, camera: report.camera, errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
