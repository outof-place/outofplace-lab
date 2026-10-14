import { expect, test, type Page } from "@playwright/test";

import manifest from "../demos.json" with { type: "json" };

// Lab-wide promises the site relies on: who may frame the lab, what search engines may index,
// and that every demo in demos.json is reachable. Expected values are written out here on
// purpose, not imported from lab/site.ts, so a wrong constant there turns this red.

const FRAME_ANCESTORS = "frame-ancestors https://www.outofplace.space http://localhost:* http://127.0.0.1:*";
const demoPaths = manifest.demos.map((d) => `/demos/${d.slug}`);
const firstDemo = demoPaths[0];

test("every page lets only the site and localhost frame it", async ({ request }) => {
  for (const path of ["/", ...demoPaths]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-security-policy"], path).toBe(FRAME_ANCESTORS);
    expect(res.headers()["x-frame-options"], `${path} must not send X-Frame-Options`).toBeUndefined();
  }
});

test("demo pages are noindex, follow; the index can be indexed", async ({ request, page }) => {
  for (const path of demoPaths) {
    const res = await request.get(path);
    expect(res.headers()["x-robots-tag"], path).toBe("noindex, follow");
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", "noindex, follow");
  }
  const index = await request.get("/");
  expect(index.headers()["x-robots-tag"]).toBeUndefined();
  await page.goto("/");
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});

test("each demo links to its post (or the blog) and to its source", async ({ page }) => {
  for (const demo of manifest.demos) {
    await page.goto(`/demos/${demo.slug}`);
    const nav = page.getByRole("navigation", { name: "Demo" });
    const post = nav.getByRole("link", { name: demo.post ? "Read the post" : "Blog" });
    await expect(post).toHaveAttribute("href", demo.post ?? "https://www.outofplace.space/blog");
    await expect(nav.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      new RegExp(`^https://github\\.com/outof-place/outofplace-lab/tree/[0-9a-f]{40}/app/demos/${demo.slug}$`),
    );
  }
});

test("the index lists every demo, and each link opens it", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("list", { name: "Demos" });
  await expect(list.getByRole("listitem")).toHaveCount(manifest.demos.length);
  for (const demo of manifest.demos) {
    await page.goto("/");
    await page.getByRole("link", { name: demo.title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/demos/${demo.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(demo.title);
  }
});

test("version.json names the commit the build came from", async ({ request }) => {
  const res = await request.get("/version.json");
  expect(res.status()).toBe(200);
  expect((await res.json()).commit).toMatch(/^[0-9a-f]{40}$/);
});

/**
 * Open `parentOrigin` (answered by Playwright, never by the network) with a page that frames
 * a demo. Reports whether the demo rendered inside the frame, and why the frame's request
 * failed if it did.
 */
async function frameFrom(page: Page, parentOrigin: string, demoUrl: string) {
  let failure: string | null = null;
  page.on("requestfailed", (req) => {
    if (req.url() === demoUrl) failure = req.failure()?.errorText ?? "failed";
  });
  const parent = `${parentOrigin}/lab-frame-check`;
  await page.route(parent, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>frame check</title>
        <iframe src="${demoUrl}" width="800" height="600"
          onload="document.body.dataset.frameLoaded = 'yes'"></iframe>`,
    }),
  );
  await page.goto(parent);
  await expect(page.locator("body[data-frame-loaded='yes']")).toBeAttached();
  const rendered = (await page.frameLocator("iframe").locator("[data-lab-shell]").count()) > 0;
  return { rendered, failure };
}

test("www.outofplace.space can frame a demo", async ({ page, baseURL }) => {
  const result = await frameFrom(page, "https://www.outofplace.space", new URL(firstDemo!, baseURL).href);
  expect(result).toEqual({ rendered: true, failure: null });
});

test("another origin cannot frame a demo", async ({ page, baseURL }) => {
  const result = await frameFrom(page, "https://evil.example", new URL(firstDemo!, baseURL).href);
  // ERR_BLOCKED_BY_RESPONSE is Chrome refusing the frame because of the response's CSP,
  // not a network error or a local-network block.
  expect(result).toEqual({ rendered: false, failure: "net::ERR_BLOCKED_BY_RESPONSE" });
});
