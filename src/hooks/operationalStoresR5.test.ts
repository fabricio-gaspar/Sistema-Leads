import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lead } from '@/mocks/leadsData';
import { sessionContext } from '@/lib/sessionContext';
import { getLeadsSnapshot, refreshLeadsStore, useLeadsStore } from './useLeadsStore';
import { getListasSnapshot, refreshListsStore, useListasStore, type ListaDeLeads } from './useListasStore';

const remote = vi.hoisted(() => ({ leads: vi.fn(), lists: vi.fn(), saveLeads: vi.fn(), saveLists: vi.fn() }));
vi.mock('@/lib/crm/leadsRepository', () => ({ loadOperationalLeads: remote.leads, persistOperationalLeads: remote.saveLeads }));
vi.mock('@/lib/crm/operationalEntitiesRepository', () => ({ loadOperationalLists: remote.lists, persistOperationalLists: remote.saveLists }));
const setContext = (user: string, org: string) => sessionContext.confirm(sessionContext.replace(user), user, org);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { vi.resetAllMocks(); sessionContext.replace(null); });

describe('R5 — production leads/lists adapters with synthetic repositories', () => {
  it('T-R5-021 / historical T-UI-006: the real lead store resets on B and never reuses hydrated A', async () => {
    setContext('A', 'org-A'); remote.leads.mockResolvedValueOnce([{ id: crypto.randomUUID(), nome: 'lead-A' }] as Lead[]);
    await refreshLeadsStore(); expect(getLeadsSnapshot()[0].nome).toBe('lead-A');
    setContext('B', 'org-B'); expect(getLeadsSnapshot()).toEqual([]);
    remote.leads.mockResolvedValueOnce([{ id: crypto.randomUUID(), nome: 'lead-B' }] as Lead[]); await refreshLeadsStore();
    expect(getLeadsSnapshot()[0].nome).toBe('lead-B'); expect(remote.leads).toHaveBeenCalledTimes(2);
  });
  it('T-R5-022 / historical T-UI-007: same user switching organizations clears and reloads lists', async () => {
    setContext('A', 'org-A'); remote.lists.mockResolvedValueOnce([{ id: 'list-A', nome: 'A' }] as ListaDeLeads[]);
    await refreshListsStore(); setContext('A', 'org-B'); expect(getListasSnapshot()).toEqual([]);
    remote.lists.mockResolvedValueOnce([{ id: 'list-B', nome: 'B' }] as ListaDeLeads[]); await refreshListsStore();
    expect(getListasSnapshot().map((list) => list.nome)).toEqual(['B']); expect(remote.lists).toHaveBeenCalledTimes(2);
  });
  it('T-R5-023: retained real lead and list callbacks reject cross-generation edits', async () => {
    setContext('A', 'org-A'); remote.leads.mockResolvedValue([]); remote.lists.mockResolvedValue([]);
    await Promise.all([refreshLeadsStore(), refreshListsStore()]);
    let setLeads!: ReturnType<typeof useLeadsStore>[1]; let createList!: ReturnType<typeof useListasStore>['criar'];
    function Harness() { [, setLeads] = useLeadsStore(); createList = useListasStore().criar; return null; }
    renderToString(createElement(Harness)); setContext('B', 'org-B'); await Promise.all([refreshLeadsStore(), refreshListsStore()]);
    expect(() => setLeads([{ id: crypto.randomUUID(), nome: 'A' } as Lead])).toThrow('session_context_changed');
    expect(() => createList({ nome: 'A' } as Parameters<typeof createList>[0])).toThrow('session_context_changed');
    expect(remote.saveLeads).not.toHaveBeenCalled(); expect(remote.saveLists).not.toHaveBeenCalled();
  });
  it('T-R5-024: late real-store load after logout never reappears in the next session', async () => {
    setContext('A', 'org-A'); const old = deferred<Lead[]>(); remote.leads.mockReturnValueOnce(old.promise);
    const pending = refreshLeadsStore(); const failure = expect(pending).rejects.toThrow('session_context_changed');
    sessionContext.replace(null); setContext('B', 'org-B'); remote.leads.mockResolvedValueOnce([]); await refreshLeadsStore();
    old.resolve([{ id: crypto.randomUUID(), nome: 'A' } as Lead]); await failure; expect(getLeadsSnapshot()).toEqual([]);
  });
});
