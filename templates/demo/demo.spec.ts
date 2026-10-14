// lab:template (replace with one test per claim the post makes; `lab check` fails while this line is here)
import { expect, test } from "@playwright/test";

const path = "/demos/__SLUG__";

// Each test names one claim of the post and fails when that claim stops being true.
test("the demo page renders its title", async ({ page }) => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("__TITLE__");
});
