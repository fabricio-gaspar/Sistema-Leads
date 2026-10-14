import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDir, './src'),
      'npm:apify-client@2.25.0/browser': resolve(rootDir, './node_modules/apify-client/dist/bundle.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    clearMocks: true,
  },
});
