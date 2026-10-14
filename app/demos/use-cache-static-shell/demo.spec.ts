import { expect, test, type Page } from "@playwright/test";

const path = "/demos/use-cache-static-shell";

const cachedBox = (page: Page) => page.getByRole("region", { name: "Cached with use cache" });
const requestBox = (page: Page) => page.getByRole("region", { name: "Rendered per request" });

/** The server's render time shown in a box, in ms since the epoch. */
async function renderedAt(box: ReturnType<Page["getByRole"]>): Promise<number> {
  const value = await box.locator("time").getAttribute("datetime");
  const ms = Date.parse(value ?? "");
  expect(ms, `a <time datetime> in the box, got ${value}`).not.toBeNaN();
  return ms;
}

test("the cached time is the same on every load", async ({ page }) => {
  await page.goto(path);
  const first = await renderedAt(cachedBox(page));
  await page.waitForTimeout(1_100);
  await page.reload();
  expect(await renderedAt(cachedBox(page))).toBe(first);
});

test("the per-request time is new on every load", async ({ page }) => {
  await page.goto(path);
  const first = await renderedAt(requestBox(page));
  await page.waitForTimeout(1_100);
  await page.reload();
  expect(await renderedAt(requestBox(page))).toBeGreaterThan(first);
});

test("the cached time was rendered before the request arrived", async ({ page }) => {
  await page.goto(path);
  expect(await renderedAt(cachedBox(page))).toBeLessThan(await renderedAt(requestBox(page)));
});

test("the static shell holds the cached time and the fallback, not the request time", async ({ browser, baseURL }) => {
  // Without JavaScript the browser shows only the shell: React needs a script to put the
  // streamed part in place of its fallback.
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(path);
  await expect(cachedBox(page).locator("time")).toBeVisible();
  await expect(requestBox(page).getByText("Rendering at request time")).toBeVisible();
  await expect(requestBox(page).locator("time")).toHaveCount(0);
  await context.close();
});
