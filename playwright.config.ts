import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'],['html',{open:'never'}]] : 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
    {name:'mobile-chromium',use:{...devices['Desktop Chrome'],viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
  ],
  webServer: {
    command:'npm run dev',
    url:'http://127.0.0.1:3000',
    timeout:120_000,
    reuseExistingServer:!process.env.CI
  }
});
