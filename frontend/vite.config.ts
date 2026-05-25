import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4000,
    proxy: {
      "/api": {
        target: process.env.VITE_DICTIONARY_PROXY_TARGET ?? "http://127.0.0.1:4001",
        changeOrigin: true,
      },
    },
  },
});
