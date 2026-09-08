import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out =
  process.env.TOOL_EVIDENCE ?? "specs/done/help-the-fly-escape/assets/evidence/14/tools/workbench";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.ASSET_URL ?? "http://127.0.0.1:5213");
  await page.locator("#tool-status").filter({ hasText: "tool assets ready" }).waitFor();
  await page.locator(".status").filter({ hasText: "triangles" }).waitFor();
  await page.getByRole("button", { name: "Extra close", exact: true }).click();
  for (const kind of (process.env.TOOL_KINDS ?? "vinegar,fan,lamp,shade").split(",")) {
    await page.locator("#tool-kind").selectOption(kind);
    await page.mouse.move(1425, 20);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/${kind}-close.png` });
    await page.screenshot({
      path: `${out}/${kind}-close-crop.png`,
      clip: { x: 380, y: 440, width: 690, height: 610 },
    });
    await page.locator("#tool-position").selectOption("0.5");
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}/${kind}-beside.png` });
    await page.screenshot({
      path: `${out}/${kind}-beside-crop.png`,
      clip: { x: 380, y: 440, width: 690, height: 610 },
    });
    await page.locator("#tool-position").selectOption("0");
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ errors }));
} finally {
  await browser.close();
}
