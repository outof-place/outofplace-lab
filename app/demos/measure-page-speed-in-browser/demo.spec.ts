import { expect, test, type Page } from "@playwright/test";

const path = "/demos/measure-page-speed-in-browser";

const metrics = ["Largest Contentful Paint", "Cumulative Layout Shift", "Time to First Byte", "Load time"] as const;
type Metric = (typeof metrics)[number];

// The post frames the demo at 360x480 on a phone and at 16:10 (672x420) on a desktop.
const frames = [
  { name: "phone", width: 360, height: 480 },
  { name: "desktop", width: 672, height: 420 },
];

const card = (page: Page, metric: Metric) => page.getByRole("region", { name: metric });

/** The number a card shows, once it has one (ms, or the CLS score). */
async function valueOf(page: Page, metric: Metric): Promise<number> {
  const data = card(page, metric).locator("data");
  await expect(data).not.toHaveAttribute("value", "");
  return Number(await data.getAttribute("value"));
}

const ratingOf = (page: Page, metric: Metric) => card(page, metric).locator("[data-rating]");

/** web.dev's thresholds, written out again so the test does not trust the demo's copy. */
const webDev: Record<Exclude<Metric, "Load time">, [good: number, poor: number]> = {
  "Largest Contentful Paint": [2500, 4000],
  "Cumulative Layout Shift": [0.1, 0.25],
  "Time to First Byte": [800, 1800],
};

function expected(metric: keyof typeof webDev, value: number) {
  const [good, poor] = webDev[metric];
  return value <= good ? "good" : value <= poor ? "needs improvement" : "poor";
}

test("Chromium supports both entry types the demo observes", async ({ page }) => {
  await page.goto(path);
  const supported = await page.evaluate(() => PerformanceObserver.supportedEntryTypes);
  expect(supported).toEqual(expect.arrayContaining(["largest-contentful-paint", "layout-shift", "navigation"]));
});

test("all four cards show a number after load, and load time is later than TTFB", async ({ page }) => {
  await page.goto(path);
  for (const metric of metrics) expect(Number.isFinite(await valueOf(page, metric))).toBe(true);
  const ttfb = await valueOf(page, "Time to First Byte");
  const load = await valueOf(page, "Load time");
  expect(ttfb).toBeGreaterThan(0);
  expect(load).toBeGreaterThan(ttfb);
  expect(await valueOf(page, "Largest Contentful Paint")).toBeGreaterThan(0);
});

test("the labels follow web.dev's thresholds, and load time has none", async ({ page }) => {
  await page.goto(path);
  for (const metric of ["Largest Contentful Paint", "Cumulative Layout Shift", "Time to First Byte"] as const) {
    await expect(ratingOf(page, metric)).toHaveText(expected(metric, await valueOf(page, metric)));
  }
  await valueOf(page, "Load time");
  await expect(ratingOf(page, "Load time")).toHaveText("no threshold");
});

test("a fresh load is good on LCP and has a CLS of 0", async ({ page }) => {
  await page.goto(path);
  await expect(ratingOf(page, "Largest Contentful Paint")).toHaveText("good");
  expect(await valueOf(page, "Cumulative Layout Shift")).toBe(0);
  await expect(card(page, "Cumulative Layout Shift").locator("data")).toHaveText("0.000");
  await expect(ratingOf(page, "Cumulative Layout Shift")).toHaveText("good");
});

for (const frame of frames) {
  test(`the late banner raises CLS above 0.1, to needs improvement (${frame.name} frame)`, async ({ page }) => {
    await page.setViewportSize(frame);
    await page.goto(path);
    expect(await valueOf(page, "Cumulative Layout Shift")).toBe(0);
    await page.getByRole("button", { name: "Insert banner" }).click();
    await expect(page.getByText("A banner that arrived 1 s after your click")).toBeVisible();
    await expect.poll(() => valueOf(page, "Cumulative Layout Shift")).toBeGreaterThan(0.1);
    await expect(ratingOf(page, "Cumulative Layout Shift")).toHaveText("needs improvement");
    // The banner pushes the cards down, but LCP and CLS stay in the frame.
    await expect(card(page, "Largest Contentful Paint")).toBeInViewport();
    await expect(card(page, "Cumulative Layout Shift")).toBeInViewport();
  });

  test(`the late hero moves LCP past 3 s, to needs improvement, and leaves CLS at 0 (${frame.name} frame)`, async ({
    page,
  }) => {
    await page.setViewportSize(frame);
    await page.goto(path);
    await expect(ratingOf(page, "Largest Contentful Paint")).toHaveText("good");
    await page.getByRole("link", { name: "Late hero" }).click();
    await expect(page).toHaveURL(/\?late$/);
    await expect(page.getByText("Late hero: painted 3 s after")).toBeVisible();
    await expect.poll(() => valueOf(page, "Largest Contentful Paint")).toBeGreaterThanOrEqual(3000);
    expect(await valueOf(page, "Largest Contentful Paint")).toBeLessThan(4000);
    await expect(ratingOf(page, "Largest Contentful Paint")).toHaveText("needs improvement");
    expect(await valueOf(page, "Cumulative Layout Shift")).toBe(0);
    await expect(card(page, "Largest Contentful Paint")).toBeInViewport();
  });
}

test("the late hero moves LCP on a full desktop window too", async ({ page }) => {
  await page.goto(`${path}?late`);
  await expect.poll(() => valueOf(page, "Largest Contentful Paint")).toBeGreaterThanOrEqual(3000);
});

test("Reset loads the page again with fresh numbers", async ({ page }) => {
  await page.goto(`${path}?late`);
  await page.getByRole("button", { name: "Insert banner" }).click();
  await expect.poll(() => valueOf(page, "Cumulative Layout Shift")).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Reset" }).click();
  await expect(page).not.toHaveURL(/late/);
  await expect(page.getByText("A banner that arrived")).toHaveCount(0);
  expect(await valueOf(page, "Cumulative Layout Shift")).toBe(0);
  await page.waitForTimeout(3_500);
  await expect(page.getByText("Late hero: painted")).toHaveCount(0);
  await expect(ratingOf(page, "Largest Contentful Paint")).toHaveText("good");
});

test("the page tells lab data from field data and says INP needs a real interaction", async ({ page }) => {
  await page.goto(path);
  const notes = page.getByRole("region", { name: "Lab or field" });
  await expect(notes).toContainText("lab numbers");
  await expect(notes).toContainText("field data");
  await expect(notes).toContainText("PageSpeed Insights");
  await expect(notes).toContainText("INP, the third Core Web Vital, needs a real interaction");
});

test("on a 360x480 phone the four numbers and the buttons show without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto(path);
  for (const metric of metrics) {
    await valueOf(page, metric);
    await expect(card(page, metric)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByRole("button", { name: "Insert banner" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("link", { name: "Late hero" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("link", { name: "Reset" })).toBeInViewport({ ratio: 1 });
});
