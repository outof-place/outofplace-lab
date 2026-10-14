import { defineConfig, devices } from "@playwright/test";

/**
 * One config for both targets:
 * - LAB_BASE_URL set: test that URL (production, a preview, a server you run).
 * - unset: start `next start` on LAB_PORT (default 3100) over an existing build.
 * `node scripts/lab.mjs test` sets both and builds first; see README "Contract".
 */
const remote = process.env.LAB_BASE_URL;
const port = Number(process.env.LAB_PORT ?? 3100);
const baseURL = remote ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: ".",
  testMatch: ["app/demos/*/demo.spec.ts", "tests/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A remote target crosses the network: one retry absorbs a dropped connection, and the
  // report still counts the test as flaky.
  retries: remote ? 1 : 0,
  timeout: 30_000,
  reporter: [
    ["list"],
    ["json", { outputFile: process.env.LAB_REPORT ?? "test-results/report.json" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    // The framing tests open https://www.outofplace.space (served by Playwright) around a lab
    // on localhost; Chrome's Local Network Access check would block that before the CSP is
    // read. Production is public, so the flag changes nothing there.
    launchOptions: { args: ["--disable-features=LocalNetworkAccessChecks"] },
  },
  webServer: remote
    ? undefined
    : {
        command: `node_modules/.bin/next start --port ${port}`,
        url: `${baseURL}/version.json`,
        reuseExistingServer: false,
        timeout: 60_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
