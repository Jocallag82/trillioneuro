import { defineConfig, devices } from "@playwright/test";

const external = process.env.BASE_URL;
const PORT = 3100;

// Local runs use `next start` (production build) with throwaway test secrets.
// Set BASE_URL + DEMO_TEST_CODE to run the same suite against a deployment.
export const TEST_CODE = process.env.DEMO_TEST_CODE ?? "test-access-code-0123456789";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: external ?? `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.CHROMIUM_PATH } } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath: process.env.CHROMIUM_PATH } } },
  ],
  webServer: external
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        port: PORT,
        reuseExistingServer: false,
        env: {
          DEMO_SESSION_SECRET: "test-secret-for-local-playwright-only-0123456789",
          DEMO_TOKENS_MCCLOSKEYS_BAKERY: `${TEST_CODE},second-code-abcdefghijkl`,
        },
      },
});
