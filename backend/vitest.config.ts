import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 30000,
    // Les tests de concurrence doivent s'exécuter séquentiellement (une DB de test)
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
