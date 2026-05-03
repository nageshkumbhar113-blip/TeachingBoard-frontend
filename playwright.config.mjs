import { defineConfig } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    browserName: 'chromium',
    launchOptions: {
      executablePath
    }
  },
  webServer: {
    command: 'node tools/static-server.mjs',
    url: 'http://127.0.0.1:4173/student-app/index.html',
    reuseExistingServer: true,
    timeout: 30000
  }
});
