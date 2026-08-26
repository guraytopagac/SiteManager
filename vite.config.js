import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The CSP in index.html has to let the dev server through. A packaged build never talks to it, so
// the directive is narrowed to the app's own origin at build time.
const tightenCsp = {
  name: "tighten-csp",
  apply: "build",
  transformIndexHtml: (html) => html.replace(/connect-src[^;]*;/, "connect-src 'self';"),
};

// Builds the renderer only. The main process is not bundled, Electron loads it as it is.
export default defineConfig({
  plugins: [react(), tightenCsp],
  base: "./",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    // The port is fixed in two more places: wait-on in the dev script and DEV_SERVER_URL in
    // electron/windows/main/index.js. Falling back to a free port would open Electron on a dead URL.
    strictPort: true,
    // The installer output and the dev database are not part of the build. Watching them only
    // makes the dev server walk hundreds of megabytes and wake up on every WAL write.
    watch: { ignored: ["**/dist_electron/**", "**/database.db*"] },
  },
  build: {
    // Read back by electron-serve and by the files list in package.json, so the name is a contract.
    outDir: "dist",
    // The only runtime is Electron's own Chromium, so nothing has to be downlevelled for older
    // browsers. Raise this when Electron moves to a newer Chromium.
    target: "chrome146",
  },
});
