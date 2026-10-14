import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { integracoes } from '@/mocks/businessData';
import { fontesLeads } from '@/mocks/fontesData';

describe('visible prospecting source labels', () => {
  it('uses the approved product names while preserving the source keys', () => {
    expect(integracoes.find((integration) => integration.id === 'int-7')).toMatchObject({ nome: 'Google Maps' });
    expect(integracoes.find((integration) => integration.id === 'int-8')).toMatchObject({ nome: 'Google' });
    expect(integracoes.find((integration) => integration.id === 'int-9')).toMatchObject({ nome: 'LinkedIn · Company Search' });
    expect(fontesLeads.find((source) => source.sourceKey === 'apify')).toMatchObject({ sourceKey: 'apify', nome: 'Google Maps' });
    expect(fontesLeads.find((source) => source.sourceKey === 'google_places')).toMatchObject({ sourceKey: 'google_places', nome: 'Google' });
    expect(fontesLeads.find((source) => source.sourceKey === 'linkedin')).toMatchObject({ sourceKey: 'linkedin', nome: 'LinkedIn · Company Search' });
  });

  it('uses the same names in the visible configuration and status titles', () => {
    const apis = readFileSync(resolve('src/pages/dashboard/configuracoes/components/ApisProvidersTab.tsx'), 'utf8');
    const status = readFileSync(resolve('src/pages/dashboard/configuracoes/components/OperationalStatusTab.tsx'), 'utf8');
    const fontes = readFileSync(resolve('src/pages/dashboard/configuracoes/components/FontesTab.tsx'), 'utf8');

    expect(apis).toContain("apify: 'Google Maps'");
    expect(apis).toContain("google_places: 'Google'");
    expect(status).toContain("label: 'Google Maps'");
    expect(status).toContain("label: 'Google'");
    expect(fontes).toContain('Configure Google Maps, Google ou LinkedIn');
  });
});
