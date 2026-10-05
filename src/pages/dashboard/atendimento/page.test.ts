import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Central de Atendimento WhatsApp entry', () => {
  it('hosts the private Evolution GO connection ceremony in the Central', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');

    expect(page).toContain("import EvolutionGoPanel from '@/components/feature/EvolutionGoPanel'");
    expect(page).toContain('<EvolutionGoPanel mode="self-service" />');
  });
});
