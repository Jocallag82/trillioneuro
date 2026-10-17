import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;
export const TEST_DB = process.env.TEST_DATABASE_URL || 'postgres://rateme:rateme@localhost:5432/rateme_test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: TEST_DB, APP_URL: `http://localhost:${PORT}`, APP_ENV: 'test', APP_SECRET: 'e2e-secret-value-0001',
      STRIPE_SECRET_KEY: 'sk_test_e2e_dummy_key', STRIPE_WEBHOOK_SECRET: 'whsec_e2e_test_secret', CRON_SECRET: 'e2e-cron',
    },
  },
});
