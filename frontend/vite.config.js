import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `vite build --mode app` builds for the Android app (Capacitor), which loads files relative to the bundle.
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  base: mode === "app" ? "./" : command === "build" ? "/VITE/" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
