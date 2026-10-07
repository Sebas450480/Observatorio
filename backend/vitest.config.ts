import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Las pruebas comparten una base de datos: se ejecutan una tras otra.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
