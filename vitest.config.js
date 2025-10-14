import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [['tests/cli/**/*.test.js', 'node']],
    include: ['tests/vitest/**/*.test.js', 'tests/cli/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});
