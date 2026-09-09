import { zoomOut } from "./zoom-out.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5184";
const output =
  process.env.CAMERA_OUTPUT ??
  "/tmp/fly-camera";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = async () => JSON.parse(await page.getByTestId("playback-report").textContent());
const follow = async (id) =>
  page.waitForFunction((id) => {
    const camera = JSON.parse(
      document.querySelector('[data-testid="playback-report"]').textContent,
    ).camera;
    return camera?.following && camera.selectedFlyId === id;
  }, id);
const released = () =>
  page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera
        ?.following === false,
  );
const centered = (camera) => {
  const fly = camera.flies[camera.selectedFlyId];
  assert.ok(Math.abs(fly.x - camera.width / 2) < 1);
  assert.ok(Math.abs(fly.y - camera.height / 2) < 1);
};
try {
  await page.goto(`${base}/lab/playback`);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="playback-lab"]')?.dataset.flyCount === "20",
  );
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).renderer
        ?.modelKind === "glb",
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("slider", {name:"Playback time"}).press("Home");
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).cursorTick === 0);
  await page.getByTestId("fly-card-0").click();
  await follow(0);
  assert.equal(await page.getByRole("button", {name:"Overview", exact:true}).count(), 0);
  const initial = await report();
  centered(initial.camera);
  await page.screenshot({ path: `${output}/default-follow.png` });
  const lastCard = page.getByRole("button", { name: "Select fly 20", exact: true });
  await lastCard.click();
  await follow(19);
  assert.equal(await page.getByTestId("selected-fly").getAttribute("data-fly-id"), "19");
  const card = await lastCard.boundingBox(),
    roster = await page.getByLabel("Fly roster").boundingBox();
  assert.ok(
    card.y >= roster.y && card.y + card.height <= roster.y + roster.height,
    "Low card is fully visible",
  );
  const selected = await report();
  centered(selected.camera);
  await page.screenshot({ path: `${output}/last-card-follow.png` });
  const canvas = page.locator(".playback-world canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -100000);
  await page.waitForFunction(() => {
    const c = JSON.parse(
      document.querySelector('[data-testid="playback-report"]').textContent,
    ).camera;
    return c.distance === c.minDistance;
  });
  const close = await report();
  assert.equal(close.camera.following, true);
  assert.equal(close.camera.distance * 2, close.camera.closeDistance);
  centered(close.camera);
  assert.ok(close.camera.displayScale > 0, "extra-close keeps a visible fly");
  await page.screenshot({ path: `${output}/extra-close.png` });
  await page.mouse.wheel(0, 3000);
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera.displayScale > 1);
  const zoomedFollow = await report();
  assert.equal(zoomedFollow.camera.following, true);
  centered(zoomedFollow.camera);
  await zoomOut(page);
  const overview = await report();
  assert.equal(overview.camera.distance, overview.camera.maxDistance);
  assert.ok(overview.camera.displayScale > 1, "Overview compensates fly size");
  await page.screenshot({ path: `${output}/overview.png` });
  await page.mouse.click(box.x + 100, box.y + 200, {button: "right"});
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera.selectedFlyId === null);
  const target = (await report()).camera.flies[19];
  await page.mouse.click(box.x + target.x, box.y + target.y);
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera
        ?.following,
  );
  const picked = (await report()).camera.selectedFlyId;
  assert.equal(await page.getByTestId("selected-fly").getAttribute("data-fly-id"), String(picked));
  assert.equal(
    await page
      .getByRole("button", { name: `Select fly ${picked + 1}`, exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await zoomOut(page);
  await page.mouse.click(box.x + 100, box.y + 200, {button: "right"});
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera.selectedFlyId === null);
  const firstTarget = (await report()).camera.flies[0];
  await page.mouse.click(box.x + firstTarget.x, box.y + firstTarget.y);
  await page.waitForFunction((prior) => {
    const camera = JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera;
    return camera?.following && camera.selectedFlyId !== prior;
  }, picked);
  const otherPicked = (await report()).camera.selectedFlyId;
  assert.notEqual(otherPicked, picked, "Distinct visible models select distinct IDs");
  assert.equal(
    await page.getByTestId("selected-fly").getAttribute("data-fly-id"),
    String(otherPicked),
  );
  await lastCard.click();
  await follow(19);
  assert.equal(await canvas.evaluate((node) => getComputedStyle(node).outlineStyle), "none");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await released();
  await lastCard.click();
  await follow(19);
  // Panel keyboard events do not move the camera.
  await lastCard.focus();
  await page.keyboard.press("d");
  await page.waitForTimeout(130);
  assert.equal((await report()).camera.following, true);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("d");
  await released();
  await page.keyboard.up("d");
  await lastCard.click();
  await follow(19);
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await released();
  await page.mouse.move(1400, 150);
  await lastCard.focus();
  await page.keyboard.press("Enter");
  await follow(19);
  assert.equal(await lastCard.evaluate((node) => node.matches(":focus-visible")), true);
  await page.screenshot({ path: `${output}/keyboard-card.png` });
  // An interior subject proves the overview marker does not swallow neighboring bodies.
  await page.getByRole("button", { name: "Select fly 5", exact: true }).click();
  await follow(4);
  await zoomOut(page);
  const denseOverview = await report();
  assert.equal(denseOverview.camera.selectedFlyId, 4);
  await page.screenshot({ path: `${output}/dense-overview.png` });
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/checks.json`,
    JSON.stringify(
      {
        initial: initial.camera,
        selected: selected.camera,
        close: close.camera,
        overview: overview.camera,
        denseOverview: denseOverview.camera,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
