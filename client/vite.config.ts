import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://localhost:8091" },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
