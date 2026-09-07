import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.ASSET_LAB_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.route("**/object-thumbnails", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Object thumbnails</title>" }));
  await page.goto(`${base}/object-thumbnails`);
  const images = await page.evaluate(async () => {
    const { renderObjectThumbnails } = await import("/src/object-thumbnails.ts");
    return renderObjectThumbnails();
  });
  const output = new URL("../../../assets/tools/thumbnails/", import.meta.url);
  await mkdir(output, { recursive: true });
  for (const [kind, data] of Object.entries(images)) {
    await writeFile(new URL(`${kind}.png`, output), Buffer.from(data.split(",")[1], "base64"));
  }
  console.log(`Rendered ${Object.keys(images).length} thumbnails from current game models.`);
} finally { await browser.close(); }
