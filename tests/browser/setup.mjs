import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const output = process.env.SETUP_EVIDENCE ?? "/tmp/fly-escape-setup-evidence";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  const diagnostics = [];
  page.on("console", message => { if (message.text().startsWith("[Fly escape]")) diagnostics.push(message.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/lab/setup");
  const run = page.getByRole("button", { name: "Release the flies" });
  await run.waitFor();
  await page.waitForFunction(() => !document.querySelector(".run-setup").disabled);
  assert.equal(await page.locator(".tool-palette [title]").count(), 0);
  await page.screenshot({ path: output + "/setup.png" });
  await page.mouse.move(80, 300);
  await page.getByTestId("placement-feedback").filter({ hasText: "open floor" }).waitFor();
  await page.screenshot({ path: output + "/invalid.png" });
  await page.mouse.click(80, 300);
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole("button", { name: "Remove Apple 1", exact: true }).count(), 0);
  await page.mouse.move(680, 520);
  await page.getByTestId("placement-feedback").filter({ hasText: "Valid placement" }).waitFor();
  await page.screenshot({ path: output + "/ghost.png" });
  await page.mouse.click(680, 520);
  await page.getByRole("button", { name: "Remove Apple 1", exact: true }).waitFor();
  await page.getByRole("button", { name: "Fan 2 left", exact: true }).click();
  await page.mouse.click(560, 440);
  await page.getByRole("button", { name: "Remove Fan 2", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /Rotate/i }).count(), 0);
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(".tool-palette img")];
    return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
  });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("fly-escape-progress")));
  await page.getByRole("button", { name: "Apple #1", exact: true }).click();
  await page.mouse.click(760, 600);
  await page.waitForFunction(
    (old) =>
      JSON.parse(localStorage.getItem("fly-escape-progress")).setups["five-room-setup"][0].position
        .x !== old,
    stored.setups["five-room-setup"][0].position.x,
  );
  await page.screenshot({ path: output + "/placed.png" });
  await run.click();
  await page.getByTestId("playback-lab").waitFor();
  await page.waitForFunction(
    () => !!document.querySelector("[data-attempt-id]")?.dataset.attemptId,
    { timeout: 90000 },
  );
  assert.equal(await page.getByRole("button", { name: "Download report", exact: true }).count(), 0);
  assert.ok(diagnostics.some(line => line.startsWith("[Fly escape] attempt ready")));
  assert.ok(diagnostics.some(line => line.startsWith("[Fly escape] playback")));
  const first = JSON.parse(await page.getByTestId("playback-report").textContent());
  assert.equal(first.spec.flyCount, 20);
  assert.equal(first.spec.placements.length, 2);
  await page.getByRole("button", { name: "Cancel attempt", exact: true }).click();
  await page.getByTestId("setup-game").waitFor();
  assert.equal(await page.getByRole("button", { name: "Remove Fan 2", exact: true }).count(), 1);
  await page.getByRole("button", { name: "Remove Fan 2", exact: true }).click();
  await page.getByRole("button", { name: "Fan 2 left", exact: true }).waitFor();
  await run.click();
  await page.getByTestId("playback-lab").waitFor();
  await page.reload();
  await run.waitFor();
  await page.getByRole("button", { name: "Remove Apple 1", exact: true }).waitFor();
  assert.equal(await page.getByTestId("playback-lab").count(), 0);
  await run.click();
  await page.waitForFunction(
    () => !!document.querySelector("[data-attempt-id]")?.dataset.attemptId,
    { timeout: 90000 },
  );
  await page.waitForFunction(
    () => {
      const t = document.querySelector("[data-testid=playback-report]");
      return t && JSON.parse(t.textContent).complete;
    },
    null,
    { timeout: 240000 },
  );
  const second = JSON.parse(await page.getByTestId("playback-report").textContent());
  assert.notEqual(second.spec.rootSeed, first.spec.rootSeed);
  const progress = await page.evaluate(() => localStorage.getItem("fly-escape-progress"));
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => localStorage.getItem("fly-escape-progress")), progress);
  await page.getByTestId("playback-seek").focus();
  await page.keyboard.press("End");
  await page.waitForFunction(
    () => document.querySelector("[data-testid=playback-lab]").dataset.playbackState === "ended",
  );
  await page.screenshot({ path: output + "/result.png" });
  await page.getByRole("button", { name: "Retry — edit setup", exact: true }).click();
  await page.getByRole("button", { name: "Remove Apple 1", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Remove Apple 1", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Show placed objects").count(), 0);
  await page.getByRole("button", { name: "Put objects away", exact: true }).click();
  await page.getByRole("button", { name: "Apple 2 left", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Remove Apple 1", exact: true }).count(), 0);
  const broken = await browser.newPage();
  await broken.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage denied");
    };
    Storage.prototype.getItem = () => {
      throw new Error("storage denied");
    };
  });
  await broken.goto(base + "/lab/setup");
  await broken.getByRole("button", { name: "Release the flies" }).waitFor();
  await broken.getByText("Storage is unavailable.", { exact: false }).waitFor();
  await broken.getByRole("button", { name: "Release the flies" }).click();
  await broken.getByTestId("playback-lab").waitFor();
  await broken.close();
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/report.json",
    JSON.stringify(
      { first: first.spec, second: second.spec, result: second.result, errors },
      null,
      2,
    ),
  );
  console.log(
    "Setup, edit, refund, freeze, cancel, reload, fresh seed, complete, replay and storage failure passed.",
  );
} finally {
  await browser.close();
}
