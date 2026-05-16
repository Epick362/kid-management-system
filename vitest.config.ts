import { defineConfig } from "vitest/config";

/**
 * Separate from vite.config.ts so the Cloudflare plugin (which forbids
 * many Vite test-runner defaults) doesn't run during `pnpm test`.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
