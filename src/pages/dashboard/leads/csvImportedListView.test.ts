import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve('src/pages/dashboard/leads/page.tsx'), 'utf8');
const store = readFileSync(resolve('src/hooks/useListasStore.ts'), 'utf8');

describe('CSV imported-list deep link', () => {
  it('waits for the authoritative list membership instead of showing all or an empty portfolio', () => {
    expect(store).toContain('const { data: listas, status } = store.useSnapshot();');
    expect(store).toContain('return { listas, status, criar, atualizar };');
    expect(page).toContain("const listaImportadaCarregando = Boolean(listaIdFiltro || listaFiltro) && listas.status === 'loading';");
    expect(page).toContain("const listaImportadaComErro = Boolean(listaIdFiltro || listaFiltro) && listas.status === 'error';");
    expect(page).toContain('Carregando a lista importada…');
    expect(page).toContain('Não foi possível carregar a lista importada.');
    expect(page).toContain('onClick={() => { void refreshListsStore().catch(() => undefined); }}');
  });
});
