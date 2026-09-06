/** Measures from a real input event until a matching DOM state has had a paint opportunity. */
export async function visibleResponse(page, eventType, selector, action) {
  await page.evaluate(
    ({ eventType, selector }) => {
      window.responseMeasurement = new Promise((resolve, reject) => {
        const missingInput = setTimeout(() => reject(new Error("Expected input event did not arrive")), 10000);
        document.addEventListener(
          eventType,
          () => {
            clearTimeout(missingInput);
            const started = performance.now();
            const check = () => {
              if (document.querySelector(selector)) {
                requestAnimationFrame(() => resolve(performance.now() - started));
              } else if (performance.now() - started > 2000) {
                reject(new Error("Visible input response timed out"));
              } else requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
          },
          { once: true, capture: true },
        );
      });
    },
    { eventType, selector },
  );
  await action();
  return page.evaluate(async () => {
    try {
      return await window.responseMeasurement;
    } finally {
      delete window.responseMeasurement;
    }
  });
}
