import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('seletor de APIs da Busca de Leads', () => {
  it('recarrega as fontes e renderiza as APIs ativas sem rótulo fixo do Apify', () => {
    const page = readFileSync(resolve('src/pages/dashboard/busca-leads/page.tsx'), 'utf8');

    expect(page).toContain('void recarregarFontes()');
    expect(page).toContain('aria-label="API da busca"');
    expect(page).toContain('fontesDisponiveis.map');
    expect(page).toContain("Buscar em {fonteAtivaSelecionada?.nome || 'API selecionada'}");
    expect(page).not.toContain('Apify · fonte habilitada');
    expect(page).not.toContain('Buscar no Apify');
  });
});
