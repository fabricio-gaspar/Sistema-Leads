import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ações de exclusão na carteira de leads', () => {
  it('abre a confirmação protegida diretamente em Leads, sem redirecionar para o Funil', () => {
    const page = readFileSync(resolve('src/pages/dashboard/leads/page.tsx'), 'utf8');

    expect(page).toContain("purgeOperationalLeads(purgeLeadIds, purgeConfirmation)");
    expect(page).toContain('openLeadPurge([lead.id])');
    expect(page).toContain('openLeadPurge(selecionados)');
    expect(page).toContain('Excluir definitivamente');
    expect(page).toContain('Confirmação da exclusão definitiva');
    expect(page).not.toContain("navigate('/dashboard/funil#gestao-base-leads')");
  });
});
