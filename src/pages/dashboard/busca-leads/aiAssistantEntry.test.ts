import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('entrada contextual da IA na Busca de Leads', () => {
  it('abre uma revisão de filtros e não dispara a busca do provedor', () => {
    const page = readFileSync(resolve('src/pages/dashboard/busca-leads/page.tsx'), 'utf8');
    const dialog = readFileSync(resolve('src/pages/dashboard/busca-leads/components/ProspectingAiAssistantDialog.tsx'), 'utf8');

    expect(page).toContain('IA · Preencher busca');
    expect(page).toContain('onApply={aplicarPlanoDaIa}');
    expect(page).toContain('Filtros sugeridos pela IA foram aplicados');
    expect(dialog).toContain("action: 'suggest_filters'");
    expect(dialog).toContain('Nenhuma busca é iniciada nesta etapa.');
    expect(dialog).not.toContain("prospectar-leads");
  });
});
