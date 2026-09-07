/** Exercise the same wheel input as the player, away from edge-pan zones. */
export async function zoomOut(page) {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 100000);
  await page.waitForTimeout(100);
}
