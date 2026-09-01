import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/dist_electron/**", "**/database.db*"] },
  },
  build: {
    outDir: "dist",
    target: "chrome146",
  },
});
