import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" path alias so runtime (value) imports resolve
      // under vitest, not just type-only imports (which the transformer elides).
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
