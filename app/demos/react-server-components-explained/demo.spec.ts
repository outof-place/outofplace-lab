import { createHmac } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

const path = "/demos/react-server-components-explained";

// Written out again from signing.ts, so the test does not trust the demo's copy.
const SIGNING_KEY = "lab-demo-key-stays-on-the-server";

const serverCard = (page: Page) => page.getByRole("region", { name: "Server Component" });
const clientCard = (page: Page) => page.getByRole("region", { name: "Client Component" });

/** The value of one labelled row in a card. */
const row = (card: Locator, label: string) => card.locator(`dl > div:has(> dt:text-is("${label}")) > dd`);

const signature = (page: Page) => row(serverCard(page), "Signature");
const signedAt = async (page: Page) => (await row(serverCard(page), "Signed at").locator("time").getAttribute("datetime")) ?? "";
const count = (page: Page) => clientCard(page).getByRole("status", { name: "Count" });

async function hydrated(page: Page) {
  await expect(row(clientCard(page), "Rendered on")).toHaveText("browser, after hydration");
}

/** Everything the browser receives while it loads the page, hydrates, and takes three clicks. */
async function everythingReceived(page: Page) {
  const received: Promise<{ type: string; url: string; body: string }>[] = [];
  page.on("response", (response) => {
    const type = response.request().resourceType();
    received.push(
      response
        .text()
        .catch(() => "")
        .then((body) => ({ type, url: response.url(), body })),
    );
  });
  await page.goto(path);
  await hydrated(page);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Add one" }).click();
  await expect(count(page)).toHaveText("3");
  await page.waitForLoadState("networkidle");
  return Promise.all(received);
}

test("the server's HTML carries the Server Component's output, and the RSC payload in it carries it again", async ({
  page,
}) => {
  const response = await page.goto(path);
  const html = (await response?.text()) ?? "";
  const shown = (await signature(page).textContent()) ?? "";
  expect(shown).toMatch(/^[0-9a-f]{12}$/);

  const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
  expect(markup).toContain(`<code>${shown}</code>`);
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
  expect(inlineScripts.some((script) => script.includes(shown))).toBe(true);
});

test("the signature is an HMAC of the time, made with the server's key", async ({ page }) => {
  await page.goto(path);
  const at = await signedAt(page);
  const expected = createHmac("sha256", SIGNING_KEY).update(at).digest("hex").slice(0, 12);
  await expect(signature(page)).toHaveText(expected);
});

test("the signing key is in nothing the browser receives: not the HTML, the payload or any JavaScript file", async ({
  page,
}) => {
  const received = await everythingReceived(page);
  expect(received.filter((r) => r.type === "script").length).toBeGreaterThan(0);
  for (const { url, body } of received) expect(body, url).not.toContain(SIGNING_KEY);
});

test("only the use client file ships as JavaScript: the counter's code is in a script, the Server Components' code is in none", async ({
  page,
}) => {
  const scripts = (await everythingReceived(page)).filter((r) => r.type === "script");
  // A string from counter.tsx, and strings that exist only in server-card.tsx and page.tsx.
  expect(scripts.some((s) => s.body.includes("browser, after hydration"))).toBe(true);
  for (const serverOnly of ["Signed at", "passed in as children", "Signing on the server"]) {
    for (const { url, body } of scripts) expect(body, `${serverOnly} in ${url}`).not.toContain(serverOnly);
  }
});

test("the Client Component renders to HTML on the server first, then hydrates in the browser", async ({
  browser,
  baseURL,
}) => {
  // Without JavaScript the browser shows the server's HTML and nothing hydrates.
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const htmlOnly = await context.newPage();
  await htmlOnly.goto(path);
  await expect(row(clientCard(htmlOnly), "Rendered on")).toHaveText("server, not hydrated yet");
  await expect(count(htmlOnly)).toHaveText("0");
  await context.close();

  const browserPage = await browser.newPage({ baseURL });
  await browserPage.goto(path);
  await hydrated(browserPage);
  await browserPage.close();
});

test("the Server Component renders on the server, and so does the one passed in as children", async ({ page }) => {
  await page.goto(path);
  await hydrated(page);
  await expect(row(serverCard(page), "Rendered on")).toHaveText("server");
  await expect(row(clientCard(page), "Children")).toHaveText("server, passed in as children");
});

test("Add one changes the count in the browser with no request to the server, and the server output stays the same", async ({
  page,
}) => {
  await page.goto(path);
  await hydrated(page);
  await page.waitForLoadState("networkidle");
  const before = { at: await signedAt(page), signature: await signature(page).textContent() };

  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Add one" }).click();

  await expect(count(page)).toHaveText("3");
  expect(await signedAt(page)).toBe(before.at);
  await expect(signature(page)).toHaveText(before.signature ?? "");
  await expect(row(clientCard(page), "Children")).toHaveText("server, passed in as children");
  expect(requests).toEqual([]);
});

test("a reload asks the server again: a new time, a new signature, and the count back at 0", async ({ page }) => {
  await page.goto(path);
  await hydrated(page);
  await page.getByRole("button", { name: "Add one" }).click();
  await expect(count(page)).toHaveText("1");
  const before = { at: await signedAt(page), signature: await signature(page).textContent() };

  await page.waitForTimeout(1_100);
  await page.getByRole("link", { name: "Reload" }).click();
  await expect.poll(async () => Date.parse(await signedAt(page))).toBeGreaterThan(Date.parse(before.at));
  await expect(signature(page)).not.toHaveText(before.signature ?? "");
  await hydrated(page);
  await expect(count(page)).toHaveText("0");
});

test("on a 360x480 phone both cards, every row and the button show without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto(path);
  await hydrated(page);
  await page.getByRole("button", { name: "Add one" }).click();
  for (const label of ["Rendered on", "Signed at", "Signature"]) {
    await expect(row(serverCard(page), label)).toBeInViewport({ ratio: 1 });
  }
  for (const label of ["Rendered on", "Count", "Children"]) {
    await expect(row(clientCard(page), label)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByRole("button", { name: "Add one" })).toBeInViewport({ ratio: 1 });
  await expect(count(page)).toHaveText("1");
});
