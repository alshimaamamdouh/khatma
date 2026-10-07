import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  use: {
    ...devices['iPhone 13'], // 390×844, touch
    browserName: 'chromium',
    baseURL: 'http://localhost:5173',
    locale: 'ar'
  },
  // Always start fresh servers. Never reuse one: it could be connected to the real database.
  webServer: [
    {
      command: 'npm run dev:memory',
      cwd: '../server',
      url: 'http://localhost:3000/api',
      reuseExistingServer: false,
      timeout: 180000
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60000
    }
  ]
});
