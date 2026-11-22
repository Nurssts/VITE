import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node", // component tests opt into jsdom with a file comment
    include: ["src/**/*.test.{js,jsx}"],
  },
});
