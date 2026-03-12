import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['src/benchmarks/**', '**/node_modules/**', '**/dist/**'],
  },
});
