import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('seletor de APIs da Busca de Leads', () => {
  it('recarrega as fontes e mostra a fonte ativa no primeiro passo do assistente', () => {
    const page = readFileSync(resolve('src/pages/dashboard/busca-leads/page.tsx'), 'utf8');

    expect(page).toContain('void recarregarFontes()');
    expect(page).toContain('aria-label="Fonte da busca"');
    expect(page).toContain('fontesDisponiveis.some');
    expect(page).toContain('Fonte selecionada:');
    expect(page).toContain('const [etapa, setEtapa] = useState(1)');
    expect(page).toContain('validateProspectingWizardStep');
    expect(page).toContain('Testar com 10 empresas');
    expect(page).not.toContain('Apify · fonte habilitada');
    expect(page).not.toContain('Buscar no Apify');
  });
});
