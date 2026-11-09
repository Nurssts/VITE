import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/**/*.test.js"],
    transformMode: {
      web: [/\.[jt]sx?$/],
      ssr: [/\.([cm]?js|ts)$/],
    },
    plugins: [],
  },
});
