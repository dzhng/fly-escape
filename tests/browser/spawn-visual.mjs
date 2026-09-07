import { zoomOut } from "./zoom-out.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const output = process.env.SPAWN_EVIDENCE ?? "/tmp/fly-spawn-visual";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BRAIN_URL ?? "http://127.0.0.1:5173");
  await page.waitForFunction(
    () => document.querySelector("[data-testid=setup-game]")?.dataset.worldState === "ready",
  );
  const report = async () => JSON.parse(await page.getByTestId("playback-report").textContent());
  const captures = [];
  const shot = async (name, setup = false) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${name}.png` });
    const canvas = page.locator(setup ? ".setup-canvas canvas" : ".playback-world canvas");
    await canvas.screenshot({ path: `${output}/${name}-world.png` });
    const b = await canvas.boundingBox();
    await page.screenshot({
      path: `${output}/${name}-detail.png`,
      clip: {
        x: b.x + b.width * (setup ? 0.39 : 0.5) - 220,
        y: b.y + b.height * (setup ? 0.285 : 0.5) - 180,
        width: 440,
        height: 360,
      },
    });
    captures.push({ name, report: setup ? null : await report() });
  };
  await shot("area", true);
  await page.getByRole("button", { name: "Release the flies", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=playback-lab]")?.dataset.worldState === "ready",
    null,
    { timeout: 120000 },
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const zero = async () => {
    await page.getByTestId("playback-seek").focus();
    await page.keyboard.press("Home");
    await page.waitForFunction(
      () => Number(document.querySelector("[data-testid=playback-lab]").dataset.cursorTick) === 0,
    );
    await page.waitForTimeout(200);
  };
  await zero();
  await shot("release-follow");
  await zoomOut(page);
  await shot("release-overview");
  await page.getByRole("button", { name: "Select fly 1", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    () => Number(document.querySelector("[data-testid=playback-lab]").dataset.cursorTick) >= 10,
    null,
    { timeout: 120000 },
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await shot("early-follow");
  await zero();
  await shot("rewind-follow");
  assert.deepEqual(captures[1].report.initialBodies, captures[4].report.initialBodies);
  assert.equal(captures[4].report.cursorTick, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        captures,
        errors,
        scope:
          "Actual production setup/Run/pause/seek0 at frozen materials, lights and house; native difficulty acceptance is not claimed",
      },
      null,
      2,
    ) + "\n",
  );
  await page.getByRole("button", { name: "Cancel attempt", exact: true }).click();
} finally {
  await browser.close();
}
