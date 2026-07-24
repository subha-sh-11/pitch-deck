import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Required for @testing-library/react's automatic per-test cleanup.
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
