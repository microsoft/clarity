import { join } from "path";
import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "fs";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "line",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    ...readdirSync(join(__dirname, "packages"))
      .filter((pkg) =>
        existsSync(join(__dirname, "packages", pkg, "test")) &&
        existsSync(join(__dirname, "packages", pkg, "package.json"))
      ).map((pkg) => ({
        name: pkg,
        testDir: join(__dirname, "packages", pkg, "test"),
        use: {},
      })),

    {
      name: "e2e",
      testDir: join(__dirname, "test"),
      use: { browserName: "chromium" },
    },
  ],
});
