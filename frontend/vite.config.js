import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    host: "127.0.0.1",
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/agents": "http://127.0.0.1:8000",
      "/alerts": "http://127.0.0.1:8000",
      "/catalog": "http://127.0.0.1:8000",
      "/settings": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
});
