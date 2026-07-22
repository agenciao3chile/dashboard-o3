import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite en :5173 sirve el frontend y proxya /api al backend Fastify (:3001).
// Prod: no se usa Vite; Fastify sirve el bundle de dist/ y las rutas /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
