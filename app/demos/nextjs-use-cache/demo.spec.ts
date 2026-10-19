import { expect, test, type Page } from "@playwright/test";

const path = "/demos/nextjs-use-cache";

// Clearing a city changes what every later test sees, so the tests run one after another.
test.describe.configure({ mode: "serial" });

const row = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

/** The id and time a row shows, once it has rendered. */
async function stampOf(page: Page, name: string) {
  const r = row(page, name);
  await expect(r.locator("output")).toHaveText(/^[0-9a-f]{8}$/);
  return { id: await r.locator("output").innerText(), at: await r.locator("time").getAttribute("datetime") };
}

test("reloading keeps the cached ids and times while the uncached row changes", async ({ page }) => {
  // A first visit lets an hourly revalidation that is already due run before we compare.
  await page.goto(path);
  await page.waitForTimeout(1_000);
  await page.reload();
  const gdansk = await stampOf(page, "Gdansk");
  const krakow = await stampOf(page, "Krakow");
  const uncached = await stampOf(page, "Not cached");

  await page.getByRole("link", { name: "Reload" }).click();
  await page.waitForURL(`**${path}`);
  await expect(row(page, "Not cached").locator("output")).not.toHaveText(uncached.id);

  expect(await stampOf(page, "Gdansk")).toEqual(gdansk);
  expect(await stampOf(page, "Krakow")).toEqual(krakow);
});

test("the two cities have separate entries with different ids", async ({ page }) => {
  await page.goto(path);
  expect((await stampOf(page, "Gdansk")).id).not.toBe((await stampOf(page, "Krakow")).id);
});

test("the same argument returns the same entry", async ({ page }) => {
  await page.goto(path);
  expect(await stampOf(page, "Gdansk again")).toEqual(await stampOf(page, "Gdansk"));
});

test("clearing Gdansk changes only the Gdansk id, Krakow stays the same", async ({ page }) => {
  await page.goto(path);
  const gdansk = await stampOf(page, "Gdansk");
  const krakow = await stampOf(page, "Krakow");

  await row(page, "Gdansk").getByRole("button", { name: "Clear" }).click();
  await expect(row(page, "Gdansk").locator("output")).not.toHaveText(gdansk.id);

  const fresh = await stampOf(page, "Gdansk");
  expect(await stampOf(page, "Gdansk again")).toEqual(fresh);
  expect(await stampOf(page, "Krakow")).toEqual(krakow);
});

test("the cached ids are in the server HTML, the uncached row is not", async ({ browser, baseURL }) => {
  // Without JavaScript the browser shows only the HTML the server sent first: the static shell.
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(path);
  await expect(row(page, "Gdansk").locator("output")).toHaveText(/^[0-9a-f]{8}$/);
  await expect(row(page, "Krakow").locator("output")).toHaveText(/^[0-9a-f]{8}$/);
  await expect(row(page, "Not cached").getByText("rendering…")).toBeVisible();
  await expect(row(page, "Not cached").locator("output")).toHaveCount(0);
  await context.close();
});

test("on a 360x480 phone the rows and the clear buttons are in view", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto(path);
  for (const name of ["Gdansk", "Gdansk again", "Krakow", "Not cached"]) {
    await expect(row(page, name).locator("output")).toBeInViewport();
  }
  await expect(row(page, "Gdansk").getByRole("button", { name: "Clear" })).toBeInViewport();
  await expect(row(page, "Krakow").getByRole("button", { name: "Clear" })).toBeInViewport();});
