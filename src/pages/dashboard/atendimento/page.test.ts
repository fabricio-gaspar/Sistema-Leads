import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Central de Atendimento WhatsApp entry', () => {
  it('hosts the private WA-AKG connection ceremony in the Central', () => {
    const page = readFileSync(resolve('src/pages/dashboard/atendimento/page.tsx'), 'utf8');

    expect(page).toContain("import WaAkgPanel from '@/components/feature/WaAkgPanel'");
    expect(page).toContain('<WaAkgPanel mode="self-service" surface="central" />');
  });
});
