import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Cursor Usage Extension",
  description: "Cursor 사용량/비용 모니터링 익스텐션",
  version: "1.1.1",
  icons: {
    "16": "icons/cursor-16.png",
    "48": "icons/cursor-48.png",
    "128": "icons/cursor-128.png"
  },
  action: {
    default_title: "Cursor Usage Extension",
    default_popup: "popup.html"
  },
  options_page: "options.html",
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module"
  },
  permissions: ["storage", "alarms", "notifications"],
  host_permissions: [
    "https://api.cursor.com/*",
    "https://api.resend.com/*",
    "https://open.er-api.com/*"
  ]
});
