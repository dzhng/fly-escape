import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/assets/tools/shade.glb", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto(process.env.ASSET_URL ?? "http://127.0.0.1:5213");
  await page.locator("#tool-status").filter({ hasText: "shade load failed" }).waitFor();
  await page.waitForTimeout(300);
  assert.match(await page.locator("#tool-status").innerText(), /shade load failed/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ failedRequiredAssetStaysVisible: true, errors }));
} finally {
  await browser.close();
}
