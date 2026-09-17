// Builds the renderer only. The main process is not bundled, the shell loads it as it is.

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The page ships a content policy that allows the dev server for the hot reload socket. This narrows it at
// build time, so the permission never reaches a packaged copy. Build only, or the socket would be blocked.
const tightenCsp = {
  name: "tighten-csp",
  apply: "build",
  transformIndexHtml: (html) => html.replace(/connect-src[^;]*;/, "connect-src 'self';"),
};

export default defineConfig({
  plugins: [react(), tightenCsp],
  base: "./",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // The port is fixed in three places: here, the wait step of the dev script and the address the shell opens.
    // A drifting port would send the window to an address nothing is listening on, so it is pinned.
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/dist_electron/**", "**/database.db*"] },
  },
  build: {
    outDir: "dist",
    // Pinned to the engine that actually runs this, since the browser default emits downlevel output for
    // nothing. Raise it with the shell's major version. Source maps stay unset, the build is production already.
    target: "chrome146",
  },
});
