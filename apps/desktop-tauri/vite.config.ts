import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@cursor-usage/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
    }
  }
});
