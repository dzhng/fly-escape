import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.heldSetupReplies = [];
    window.holdSetupReplies = false;
    window.Worker = class extends NativeWorker {
      set onmessage(receive) {
        super.onmessage = (event) => {
          // Delay delivery at the browser boundary; validation still runs in the real WASM Worker.
          const deliver = () => receive.call(this, event);
          if (window.holdSetupReplies && event.data.type === "setup")
            window.heldSetupReplies.push(deliver);
          else deliver();
        };
      }
    };
  });
  await page.goto((process.env.BRAIN_URL ?? "http://127.0.0.1:5173") + "/lab/setup");
  await page.waitForFunction(() => !document.querySelector(".run-setup")?.disabled);
  async function commitThenSelect(x, y, otherControl, placedName) {
    await page.mouse.move(x, y);
    await page.getByTestId("placement-feedback").filter({ hasText: "Valid placement" }).waitFor();
    await page.evaluate(() => {
      window.holdSetupReplies = true;
    });
    await page.mouse.click(x, y);
    await page.waitForFunction(() => window.heldSetupReplies.length === 1);
    const box = await otherControl.boundingBox();
    assert.ok(box);
    // A physical click tests the UI while disabled without Playwright waiting for re-enablement.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate(() => {
      window.holdSetupReplies = false;
      for (const deliver of window.heldSetupReplies.splice(0)) deliver();
    });
    await page.getByRole("button", { name: placedName, exact: true }).waitFor({ timeout: 1500 });
  }
  await commitThenSelect(
    680,
    520,
    page.getByRole("button", { name: "Fan 2 left", exact: true }),
    "Remove Fruit 1",
  );
  await page.getByRole("button", { name: "Fan 2 left", exact: true }).click();
  await commitThenSelect(
    560,
    440,
    page.getByRole("button", { name: "Fruit #1", exact: true }),
    "Remove Fan 2",
  );
  const placements = await page.evaluate(
    () => JSON.parse(localStorage.getItem("fly-escape-progress")).setups["five-room-setup"],
  );
  assert.deepEqual(
    placements.map(({ kind }) => kind),
    ["fruit", "fan"],
  );
  console.log("Delayed committed edits survive palette and placed-tool selection attempts.");
} finally {
  await browser.close();
}
