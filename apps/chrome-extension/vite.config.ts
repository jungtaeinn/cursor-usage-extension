import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

import manifest from "./src/manifest";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@cursor-usage/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
    }
  }
});
