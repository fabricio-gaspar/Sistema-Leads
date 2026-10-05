import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getListasSnapshot, refreshListsStore, useListasStore, waitForListsPersistence, type ListaDeLeads } from './useListasStore';
import { sessionContext } from '@/lib/sessionContext';

const repository = vi.hoisted(() => ({
  load: vi.fn(),
  persist: vi.fn(),
}));

vi.mock('@/lib/crm/operationalEntitiesRepository', () => ({
  loadOperationalLists: repository.load,
  persistOperationalLists: repository.persist,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('persistência das listas de leads', () => {
  it('informa a falha, reconcilia com o servidor e só confirma a gravação seguinte após persistir', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    repository.load.mockResolvedValue([]);
    repository.persist.mockRejectedValueOnce(new Error('list_insert_failed'));
    const pending = sessionContext.replace('synthetic-user');
    sessionContext.confirm(pending, 'synthetic-user', 'synthetic-org');
    await refreshListsStore();
    repository.load.mockClear();

    let criar!: ReturnType<typeof useListasStore>['criar'];
    function Harness() {
      criar = useListasStore().criar;
      return null;
    }
    renderToString(createElement(Harness));

    const dados: Omit<ListaDeLeads, 'id' | 'criadaEm'> = {
      nome: 'Revisão Apify', segmento: 'Indústria', cidade: 'São Paulo', estado: 'SP',
      total: 1, fonte: 'Apify', leadIds: [crypto.randomUUID()], status: 'pendente',
    };
    criar(dados);
    await expect(waitForListsPersistence()).rejects.toThrow('list_insert_failed');
    expect(repository.load).toHaveBeenCalledOnce();
    expect(getListasSnapshot()).toEqual([]);

    repository.persist.mockImplementation(async (_previous: ListaDeLeads[], next: ListaDeLeads[]) => next);
    expect(() => criar(dados)).toThrow('store_refresh_required_after_write_failure');
    await refreshListsStore(); // Explicit recovery is required; a failed queue never silently replays.
    criar(dados);
    await expect(waitForListsPersistence()).resolves.toBeUndefined();
    expect(getListasSnapshot()).toHaveLength(1);
  });
});
