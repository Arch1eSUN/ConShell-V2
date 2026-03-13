// Fix macOS EPERM on /var/folders temp dirs (vitest coverage module)
if (!process.env.TMPDIR || process.env.TMPDIR.startsWith('/var/folders')) {
  process.env.TMPDIR = '/tmp';
}

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['src/benchmarks/**', '**/node_modules/**', '**/dist/**'],
  },
});
