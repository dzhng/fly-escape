import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const output = process.env.ABOUT_OUTPUT ?? "/tmp/fly-about";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const url = process.env.BRAIN_URL ?? "http://127.0.0.1:4173";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(url);
  const link = page.getByRole("link", { name: "About the data and models", exact: true });
  await link.focus();
  assert.equal(await link.evaluate((e) => e === document.activeElement), true);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "About the data and models", exact: true }).waitFor();
  assert.match(await page.locator("main").textContent(), /MaleCNS v1.0/);
  assert.match(await page.locator("main").textContent(), /simplified game models/);
  assert.equal(
    await page.getByRole("link", { name: "Creative Commons Attribution 4.0" }).getAttribute("href"),
    "https://creativecommons.org/licenses/by/4.0/",
  );
  const manifest = await page.request.get(`${url}/brain/manifest.json`);
  assert.equal(manifest.status(), 200);
  assert.equal((await manifest.json()).synthetic, false);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  await page.getByRole("link", { name: "Back to the game" }).click();
  await page.getByTestId("setup-game").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Static root About navigation, keyboard link, provenance, manifest, mobile width and return passed.",
  );
} finally {
  await browser.close();
}
