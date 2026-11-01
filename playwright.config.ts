import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://speedtrack-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-placeholder",
      VITE_SUPABASE_ANON_KEY: "public-test-placeholder",
      VITE_ROUTING_URL: "https://api.openrouteservice.org",
      VITE_ROUTING_API_KEY: "public-routing-test-placeholder",
    },
  },
});
