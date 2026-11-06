import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: "http://127.0.0.1:19372",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROME_PATH || undefined,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "npm run dev -- --port 19372 --strictPort",
    url: "http://127.0.0.1:19372",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
