import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node', include: ['docs/auditoria/2026-10-05-v3/EVIDENCIAS/mensageria/*.test.ts'], clearMocks: true } });
