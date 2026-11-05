import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const path = "/demos/react-19";
// The React build inside Next.js 16.4.3 (next/dist/compiled/react), which the App Router uses.
const bundled = "19.3.0-canary-278794d7-20261002";
const installed = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).dependencies
  .react as string;

const serverVersion = (page: Page) => page.getByRole("status", { name: "React on the server" });
const browserVersion = (page: Page) => page.getByRole("status", { name: "React in the browser" });
const notes = (page: Page) => page.getByRole("region", { name: "Notes" });
const input = (page: Page) => page.getByRole("textbox", { name: "Note" });
const button = (page: Page) => notes(page).getByRole("button");
const sending = (page: Page) => notes(page).locator('li[data-state="sending"]');
const saved = (page: Page) => notes(page).locator('li[data-state="saved"]');

/** Opens the demo and waits until React runs in the browser, so the form is wired up. */
async function open(page: Page) {
  await page.goto(path);
  await expect(browserVersion(page)).toHaveText(bundled);
}

async function add(page: Page, text: string) {
  await input(page).fill(text);
  await button(page).click();
}

test("the App Router runs React 19.3.0-canary-278794d7-20261002, not the 19.3.1 in package.json", async ({ page }) => {
  expect(installed).toBe("19.3.1");
  const scripts: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") scripts.push(response.text());
  });
  await page.goto(path);
  // Server-rendered before any JavaScript runs.
  await expect(serverVersion(page)).toHaveText(bundled);
  // Rendered again by the React the browser downloaded.
  await expect(browserVersion(page)).toHaveText(bundled);
  await page.waitForLoadState("networkidle");
  const bodies = await Promise.all(scripts);
  expect(bodies.some((js) => js.includes(`"${bundled}"`)), "a script carries the bundled version").toBe(true);
  expect(bodies.some((js) => js.includes(`"${installed}"`)), "no script carries package.json's version").toBe(false);
});

test("the note shows up at once as sending, before the server answers", async ({ page }) => {
  await open(page);
  const clicked = Date.now();
  await add(page, "Optimistic");
  await expect(sending(page)).toHaveText(/Optimistic\s*sending…/, { timeout: 1_000 });
  expect(Date.now() - clicked).toBeLessThan(1_500);
  await expect(saved(page)).toHaveCount(0);
});

test("while the action runs the button reads Adding… and is disabled", async ({ page }) => {
  await open(page);
  await expect(button(page)).toHaveText("Add");
  await add(page, "Pending");
  await expect(button(page)).toHaveText("Adding…");
  await expect(button(page)).toBeDisabled();
  await expect(saved(page)).toHaveCount(1, { timeout: 5_000 });
  await expect(button(page)).toHaveText("Add");
  await expect(button(page)).toBeEnabled();
});

test("when the Server Function returns, the note is saved with the server's time and the sending note is gone", async ({
  page,
}) => {
  await open(page);
  const before = Date.now();
  await add(page, "Saved");
  await expect(saved(page)).toHaveCount(1, { timeout: 5_000 });
  await expect(sending(page)).toHaveCount(0);
  await expect(saved(page).locator("span")).toHaveText("Saved");
  const at = Date.parse((await saved(page).locator("time").getAttribute("datetime")) ?? "");
  // The server waits 1.5 s before it stamps the note.
  expect(at - before).toBeGreaterThanOrEqual(1_400);
  await expect(saved(page).locator("time")).toHaveText(/^saved \d\d:\d\d:\d\d UTC$/);
});

test("React clears the input when the action finishes", async ({ page }) => {
  await open(page);
  await add(page, "Reset");
  // Until the action ends, the typed text stays in the field.
  await expect(input(page)).toHaveValue("Reset");
  await expect(saved(page)).toHaveCount(1, { timeout: 5_000 });
  await expect(input(page)).toHaveValue("");
});

test("an empty note comes back from the server as an error and adds nothing", async ({ page }) => {
  await open(page);
  await add(page, "   ");
  await expect(notes(page).getByRole("alert")).toHaveText("Write a note first.");
  await expect(sending(page)).toHaveCount(0);
  await expect(saved(page)).toHaveCount(0);
  // The next valid note clears the error.
  await add(page, "Valid");
  await expect(saved(page)).toHaveCount(1, { timeout: 5_000 });
  await expect(notes(page).getByRole("alert")).toHaveCount(0);
});

test("on a 360x480 phone both versions, the form and the saved note fit without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  await open(page);
  await add(page, "Phone");
  await expect(saved(page)).toHaveCount(1, { timeout: 5_000 });
  for (const element of [serverVersion(page), browserVersion(page), input(page), button(page), saved(page)]) {
    await expect(element).toBeInViewport({ ratio: 1 });
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
