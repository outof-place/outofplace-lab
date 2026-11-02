import { expect, test, type Page } from "@playwright/test";

const path = "/demos/vercel-ai-sdk-usechat-streaming";
const route = `${path}/api/chat`;
const reply = "This reply is canned: a mock model streams it word by word, as a real provider would.";

const chat = (page: Page) => page.getByRole("region", { name: "Chat" });
const status = (page: Page) => page.getByRole("status", { name: "Status" });
const messages = (page: Page) => page.getByRole("list", { name: "Messages" }).getByRole("listitem");
const userMessage = (page: Page) => page.locator('li[data-role="user"]');
const assistantMessage = (page: Page) => page.locator('li[data-role="assistant"]');
const input = (page: Page) => page.getByRole("textbox", { name: "Message" });
const sendButton = (page: Page) => page.getByRole("button", { name: "Send" });

type Recorded = { statuses: string[]; replies: string[] };

/** Records every status the page shows and every version of the reply text, in order. */
async function record(page: Page) {
  await page.evaluate(() => {
    const log = { statuses: [] as string[], replies: [] as string[] };
    (window as unknown as { __log: typeof log }).__log = log;
    const root = document.querySelector('section[aria-label="Chat"]')!;
    const take = () => {
      const s = root.querySelector('output[aria-label="Status"]')?.textContent ?? "";
      if (log.statuses.at(-1) !== s) log.statuses.push(s);
      const r = root.querySelector('li[data-role="assistant"] p')?.textContent ?? "";
      if (r && log.replies.at(-1) !== r) log.replies.push(r);
    };
    take();
    new MutationObserver(take).observe(root, { subtree: true, childList: true, characterData: true });
  });
}

const recorded = (page: Page) =>
  page.evaluate(() => (window as unknown as { __log: Recorded }).__log);

/** Types a message and presses Send, once the page is hydrated and the button reacts. */
async function send(page: Page, text: string) {
  await expect(async () => {
    await input(page).fill(text);
    await expect(sendButton(page)).toBeEnabled({ timeout: 500 });
  }).toPass();
  await sendButton(page).click();
}

test("sending a message adds it at once, and status turns submitted, then streaming", async ({ page }) => {
  await page.goto(path);
  await expect(status(page)).toHaveText("ready");
  await record(page);
  await send(page, "Hello");
  // Before any of the reply has arrived, the user's message is in the list.
  await expect(userMessage(page)).toContainText("Hello");
  await expect(status(page)).toHaveText(/^(submitted|streaming)$/);
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  expect((await recorded(page)).statuses).toEqual(["ready", "submitted", "streaming", "ready"]);
});

test("the reply grows over several chunks, not in one step", async ({ page }) => {
  await page.goto(path);
  await record(page);
  await send(page, "Hello");
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  const { replies } = await recorded(page);
  expect(replies.length, `reply versions seen: ${JSON.stringify(replies)}`).toBeGreaterThanOrEqual(5);
  replies.slice(1).forEach((next, i) => {
    const previous = replies[i] ?? "";
    expect(next.startsWith(previous), `"${next}" grows from "${previous}"`).toBe(true);
  });
  expect(replies.at(-1)).toBe(reply);
});

test("status ends at ready and the input is usable again", async ({ page }) => {
  await page.goto(path);
  await send(page, "First");
  await expect(input(page)).toBeDisabled();
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  await expect(input(page)).toBeEnabled();
  await send(page, "Second");
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  await expect(messages(page)).toHaveCount(4);
});

test("the assistant message is rendered from parts of type text", async ({ page }) => {
  await page.goto(path);
  await send(page, "Hello");
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  const textParts = assistantMessage(page).locator('[data-part="text"]');
  await expect(textParts).toHaveCount(1);
  await expect(textParts).toHaveText(reply);
  await expect(assistantMessage(page).locator("p")).toHaveText(reply);
  await expect(assistantMessage(page).locator("code")).toHaveText("parts: step-start, text");
});

test("no request goes to an AI provider, only to the demo's own route", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: { method: string; url: string }[] = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto(path);
  await send(page, "Hello");
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  const foreign = requests.filter((r) => !r.url.startsWith("data:") && new URL(r.url).origin !== origin);
  expect(foreign, "requests to other origins").toEqual([]);
  expect(requests.filter((r) => r.method === "POST").map((r) => new URL(r.url).pathname)).toEqual([route]);
});

test("the route streams Server-Sent Events: start, text deltas, finish, [DONE]", async ({ request }) => {
  const response = await request.post(route, {
    data: { id: "spec", messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] }] },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/event-stream");
  expect(response.headers()["x-vercel-ai-ui-message-stream"]).toBe("v1");
  const events = (await response.text())
    .split("\n\n")
    .filter((block) => block.startsWith("data: "))
    .map((block) => block.slice("data: ".length));
  expect(events.at(-1)).toBe("[DONE]");
  const parts = events.slice(0, -1).map((e) => JSON.parse(e) as { type: string; delta?: string });
  const types = parts.map((p) => p.type);
  expect(types.filter((t) => t !== "text-delta")).toEqual([
    "start",
    "start-step",
    "text-start",
    "text-end",
    "finish-step",
    "finish",
  ]);
  const deltas = parts.filter((p) => p.type === "text-delta");
  expect(deltas).toHaveLength(17);
  expect(deltas.map((p) => p.delta).join("")).toBe(reply);
});

test("a reload clears the chat, since nothing is stored", async ({ page }) => {
  await page.goto(path);
  await send(page, "Hello");
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  await expect(messages(page)).toHaveCount(2);
  await page.reload();
  await expect(status(page)).toHaveText("ready");
  await expect(messages(page)).toHaveCount(0);
});

test("on a 360x480 phone the status, both messages and the input fit without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto(path);
  await send(page, "Hello");
  await expect(status(page)).toHaveText("ready", { timeout: 10_000 });
  for (const element of [
    status(page),
    userMessage(page),
    assistantMessage(page),
    input(page),
    sendButton(page),
  ]) {
    await expect(element).toBeInViewport({ ratio: 1 });
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(chat(page)).toBeVisible();
});
