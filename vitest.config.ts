import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: resolve(rootDir, './src') },
      { find: 'npm:apify-client@2.25.0/browser', replacement: resolve(rootDir, './node_modules/apify-client/dist/bundle.js') },
      { find: 'npm:apify-client@2.25.0', replacement: resolve(rootDir, './supabase/tests/fixtures/apifyClient.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    clearMocks: true,
  },
});
