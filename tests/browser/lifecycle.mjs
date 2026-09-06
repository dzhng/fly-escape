import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const output = new URL("../../specs/help-the-fly-escape/assets/evidence/04/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ready = () =>
  page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find((b) => b.textContent === "One tick").disabled,
  );
const sample = async () => {
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save sample" }).click();
  return JSON.parse(await readFile(await (await saved).path(), "utf8"));
};
try {
  await page.goto(`${base}/lab/lifecycle`);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset probe" }).click();
  await ready();
  const records = {};
  for (const scenario of ["mealThenStarvation", "proboscisSilenced", "openExit", "blockedExit"]) {
    await page.getByLabel("Probe", { exact: true }).selectOption(scenario);
    await ready();
    let lastReserve = Number(await page.getByTestId("reserve").textContent());
    let gain = 0,
      capturedMeal = false;
    for (let tick = 1; tick <= 300; tick++) {
      await page.getByRole("button", { name: "One tick", exact: true }).click();
      await page.waitForFunction(
        (n) => document.querySelector('[data-testid="lifecycle-tick"]').textContent === `Tick ${n}`,
        tick,
      );
      const reserve = Number(await page.getByTestId("reserve").textContent());
      gain += Math.max(0, reserve - lastReserve);
      lastReserve = reserve;
      if (scenario === "mealThenStarvation" && gain > 0.5 && !capturedMeal) {
        await page.screenshot({ path: new URL("lifecycle-meal.png", output).pathname });
        capturedMeal = true;
      }
      if (await page.getByTestId("lifecycle-result").count()) break;
    }
    if (scenario === "mealThenStarvation") {
      const log = page.getByRole("list", { name: "Recorded events" });
      await log.focus();
      await log.press("Home");
      await page.waitForFunction(() => document.querySelector(".lifecycle-events").scrollTop === 0);
      await log.press("End");
      await page.waitForFunction(
        () => {
          const el = document.querySelector(".lifecycle-events");
          return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        },
        undefined,
        { timeout: 2000 },
      );
      await page.getByRole("heading", { name: "Recorded events" }).click();
    }
    records[scenario] = { ...(await sample()), reserveGain: gain };
    await page.screenshot({ path: new URL(`lifecycle-${scenario}.png`, output).pathname });
  }
  const meal = records.mealThenStarvation,
    silenced = records.proboscisSilenced;
  assert.ok(meal.reserveGain > 0.5, "actual neural meal extends reserve");
  assert.equal(meal.frame.result.outcomes.starved, 1);
  assert.ok(meal.events.some((e) => e.event.kind.type === "feedingStarted"));
  assert.ok(
    meal.events.some(
      (e) => e.event.kind.type === "feedingEnded" && e.event.kind.reason === "contactLost",
    ),
  );
  assert.equal(silenced.reserveGain, 0);
  assert.ok(!silenced.events.some((e) => e.event.kind.type === "feedingStarted"));
  assert.equal(silenced.frame.result.outcomes.starved, 1);
  assert.ok(meal.frame.tick > silenced.frame.tick, "the meal extends life");
  assert.equal(records.openExit.frame.result.outcomes.escaped, 1);
  assert.equal(records.openExit.frame.result.stars, 1);
  assert.equal(records.blockedExit.frame.result.outcomes.escaped, 0);
  assert.equal(records.blockedExit.frame.result.stars, 0);
  for (const record of Object.values(records))
    assert.equal(record.events.filter((e) => e.event.kind.type === "terminal").length, 1);
  await page.getByRole("button", { name: "Reset probe" }).click();
  await ready();
  await page.getByRole("button", { name: "One tick", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="lifecycle-tick"]').textContent === "Tick 1",
  );
  const first = await sample();
  await page.getByRole("button", { name: "Reset probe" }).click();
  await ready();
  await page.getByRole("button", { name: "One tick", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="lifecycle-tick"]').textContent === "Tick 1",
  );
  assert.deepEqual((await sample()).frame, first.frame);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByLabel("Probe", { exact: true }).selectOption("openExit");
  await page.getByTestId("lifecycle-result").waitFor();
  await page.getByLabel("Probe", { exact: true }).selectOption("blockedExit");
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[data-testid="lifecycle-tick"]').textContent.split(" ")[1]) >
      0,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("browser.json", output),
    JSON.stringify({ browser: browser.version(), errors, records }, null, 2),
  );
  console.log(
    JSON.stringify({
      mealExtendsLife: true,
      neuralAblation: true,
      sweptExit: true,
      sameSeedReset: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
