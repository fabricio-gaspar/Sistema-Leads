import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  integrationRuntimeMode,
  leadSourceRuntimeMode,
} from '../functions/_shared/integrationRuntimeMode.ts';

describe('integration runtime mode contract', () => {
  it('uses the integrations table vocabulary without changing the prospecting source vocabulary', () => {
    expect(integrationRuntimeMode).toBe('real');
    expect(leadSourceRuntimeMode).toBe('production');
  });

  it('uses the shared modes in each Edge write path', () => {
    const configure = readFileSync(new URL('../functions/configurar-integracao/index.ts', import.meta.url), 'utf8');
    const diagnostics = readFileSync(new URL('../functions/operational-diagnostics/index.ts', import.meta.url), 'utf8');
    const testIntegration = readFileSync(new URL('../functions/testar-integracao/index.ts', import.meta.url), 'utf8');

    expect(configure).toContain('mode: integrationRuntimeMode');
    expect(configure).toContain('mode: leadSourceRuntimeMode');
    expect(diagnostics).toContain('mode: integrationRuntimeMode');
    expect(testIntegration).toContain('mode: leadSourceRuntimeMode');
  });
});
