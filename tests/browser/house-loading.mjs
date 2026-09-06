import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
const url = `${process.env.ASSET_LAB_URL ?? "http://127.0.0.1:5174"}/?fixture=house`;
try {
  await page.route(/\/assets\/house\/solid\.glb$/, async (route) => {
    await page
      .locator("#house-status")
      .filter({ hasText: /wall loaded|floor loaded/ })
      .waitFor();
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  await page.goto(url);
  await page
    .locator("#house-status")
    .filter({ hasText: /retained|failed/i })
    .waitFor();
  await page.waitForFunction(() => document.querySelector("#app").dataset.houseReady !== undefined);
  assert.notEqual(
    await page.locator("#app").getAttribute("data-house-ready"),
    "true",
    "failed initial kit must not report ready",
  );
  await page.unrouteAll();
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#app").dataset.houseReady === "true");
  await page.locator("#part").selectOption("solid");
  await page
    .locator("#house-file")
    .setInputFiles({ name: "bad.glb", mimeType: "model/gltf-binary", buffer: Buffer.from("bad") });
  await page.locator("#house-status").filter({ hasText: "Previous part retained" }).waitFor();
  assert.equal(
    await page.locator("#app").getAttribute("data-house-ready"),
    "true",
    "failed later replacement retains complete kit",
  );
  console.log(
    "Initial asset failure stays unready; reload succeeds; failed replacement retains ready kit.",
  );
} finally {
  await browser.close();
}
