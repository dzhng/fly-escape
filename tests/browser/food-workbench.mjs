import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const output =
  process.env.FOOD_WORKBENCH_EVIDENCE ??
  "specs/help-the-fly-escape/assets/evidence/14/food/workbench";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.ASSET_URL ?? "http://127.0.0.1:5210");
  await page.locator("#tool-status").filter({ hasText: "tool assets ready" }).waitFor();
  await page.locator(".status").filter({ hasText: "triangles" }).waitFor();
  await page.getByRole("button", { name: "Extra close", exact: true }).click();
  const setTime = async (value) =>
    page.locator("#time").evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  await page.locator("#clip").selectOption("Feed");
  await setTime(0.5);
  for (const kind of ["fruit", "crumbs"]) {
    await page
      .locator("#clip")
      .selectOption(kind === "fruit" ? "Feed" : "Static");
    await setTime(0.5);
    await page.locator("#tool-kind").selectOption(kind);
    await page.mouse.move(1430, 20);
    await page.waitForTimeout(100);
    await page.screenshot({ path: output + "/" + kind + ".png" });
  }
  await page.locator("#tool-kind").selectOption("fruit");
  await page.waitForTimeout(100);
  const canvas = page.locator("canvas"),
    before = await canvas.screenshot();
  await page.locator("#tool-file").setInputFiles("assets/food/fruit.glb");
  await page.locator("#tool-status").filter({ hasText: "fruit ·" }).waitFor();
  assert.deepEqual(
    await canvas.screenshot(),
    before,
    "valid replacement preserves shape/phase",
  );
  await page.locator("#tool-file").setInputFiles("assets/fly/fly.glb");
  await page.locator("#tool-status").filter({ hasText: "Error:" }).waitFor();
  assert.deepEqual(
    await canvas.screenshot(),
    before,
    "invalid raised asset preserves accepted food",
  );
  await page.locator("#tool-status").scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + "/rejected-replacement.png" });
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/report.json",
    JSON.stringify(
      {
        validReplacement: "exact canvas",
        invalidRaisedReplacement: "rejected; exact prior canvas",
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
