import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src'), 'server-only': path.resolve(import.meta.dirname, 'tests/stubs/empty.ts') } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://rateme:rateme@localhost:5432/rateme_test',
      APP_ENV: 'test', APP_URL: 'http://localhost:3200', APP_SECRET: 'unit-test-secret',
      STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: 'whsec_unit_test',
    },
  },
});
