import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { supabaseConfig } from "./src/services/supabaseConfig.ts";
export default defineConfig(({ mode }) => {
  // Fail before bundling a privileged key into web assets or the APK.
  supabaseConfig(loadEnv(mode, process.cwd(), "VITE_"));
  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) =>
            id.includes("recharts") ? "charts" : undefined,
        },
      },
    },
  };
});
