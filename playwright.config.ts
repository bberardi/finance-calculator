import { defineConfig } from '@playwright/test';

// End-to-end smoke-test config (roadmap 6.2). The Chromium binary is provisioned
// out of band — the dev sandbox via PLAYWRIGHT_BROWSERS_PATH, and CI via the
// official Playwright Docker image (browsers baked in at /ms-playwright) — so
// `playwright test` never needs to reach cdn.playwright.dev. Playwright boots the
// Vite dev server itself (see `webServer`) and tears it down when the run ends.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      // Use the bundled Chromium directly (no `channel`) so the provisioned
      // browser is used rather than a system Chrome install.
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 900 },
        // The official Playwright CI image runs as root, where Chromium refuses
        // to start its sandbox; disable it in CI only. Local runs (non-root)
        // keep the sandbox.
        launchOptions: process.env.CI ? { args: ['--no-sandbox'] } : {},
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/finance-calculator/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
