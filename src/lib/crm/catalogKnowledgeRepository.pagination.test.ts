import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProspectingCatalogOffers } from './catalogKnowledgeRepository';

const remote = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ table: string; start: number; end: number; filters: Array<[string, unknown]>; itemTypes: string[]; sourceIds: string[] }>,
  from: vi.fn(),
  resolveOrganizationSession: vi.fn(),
  assertOrganizationSession: vi.fn(),
  errorAtStart: -1,
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: remote.from } }));
vi.mock('@/lib/organizationSession', () => ({
  resolveOrganizationSession: remote.resolveOrganizationSession,
  assertOrganizationSession: remote.assertOrganizationSession,
}));

function catalogRow(index: number): Record<string, unknown> {
  return {
    id: `item-${index}`, source_id: 'source-1', item_type: 'product', external_key: `product-${index}`,
    status: 'active', ana_enabled: true, name: `Produto ${index}`, code: null, short_description: null,
    technical_description: null, category: 'Equipamentos', material: null, applications: ['Indústria'],
    qualification_questions: [], keywords: [], image_url: null, attachment_url: null, website_url: null,
    source_url: 'https://example.test/catalog', source_label: 'Catálogo', imported_at: null,
    updated_at: '2026-10-15T12:00:00Z',
  };
}

beforeEach(() => {
  remote.rows.splice(0);
  remote.calls.splice(0);
  remote.from.mockReset();
  remote.resolveOrganizationSession.mockReset().mockResolvedValue({ organizationId: 'org-a', userId: 'user-a', context: {} });
  remote.assertOrganizationSession.mockReset();
  remote.errorAtStart = -1;
  remote.from.mockImplementation((table: string) => {
    const filters: Array<[string, unknown]> = [];
    const itemTypes: string[] = [];
    const sourceIds: string[] = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
      in: vi.fn((column: string, values: string[]) => { (column === 'source_id' ? sourceIds : itemTypes).push(...values); return query; }),
      order: vi.fn(() => query),
      range: vi.fn(async (start: number, end: number) => {
        remote.calls.push({ table, start, end, filters: [...filters], itemTypes: [...itemTypes], sourceIds: [...sourceIds] });
        if (start === remote.errorAtStart) return { data: null, error: new Error('catalog_page_failed') };
        return { data: remote.rows.slice(start, end + 1), error: null };
      }),
    };
    return query;
  });
});

describe('paginated prospecting catalog offers', () => {
  it('loads more than the former 120-item cutoff without losing organization or active-type filters', async () => {
    remote.rows.push(...Array.from({ length: 201 }, (_, index) => catalogRow(index)));

    const offers = await loadProspectingCatalogOffers(['source-1']);

    expect(offers).toHaveLength(201);
    expect(offers[0]).toMatchObject({ id: 'item-0', name: 'Produto 0' });
    expect(offers[200]).toMatchObject({ id: 'item-200', name: 'Produto 200' });
    expect(remote.calls.map(({ start, end }) => [start, end])).toEqual([[0, 199], [200, 399]]);
    for (const call of remote.calls) {
      expect(call.table).toBe('knowledge_catalog_items');
      expect(call.filters).toContainEqual(['organization_id', 'org-a']);
      expect(call.filters).toContainEqual(['status', 'active']);
      expect(call.itemTypes).toEqual(['product', 'service']);
      expect(call.sourceIds).toEqual(['source-1']);
    }
    expect(remote.assertOrganizationSession).toHaveBeenCalledTimes(2);
  });

  it('rejects an oversized catalog rather than silently omitting old offers', async () => {
    remote.rows.push(...Array.from({ length: 1001 }, (_, index) => catalogRow(index)));

    await expect(loadProspectingCatalogOffers(['source-1'])).rejects.toThrow('prospecting_catalog_limit_exceeded');
    expect(remote.calls.at(-1)).toMatchObject({ start: 1000, end: 1000 });
  });

  it('rejects a later page error instead of presenting a partial catalog', async () => {
    remote.rows.push(...Array.from({ length: 201 }, (_, index) => catalogRow(index)));
    remote.errorAtStart = 200;

    await expect(loadProspectingCatalogOffers(['source-1'])).rejects.toThrow('catalog_page_failed');
    expect(remote.calls.map(({ start }) => start)).toEqual([0, 200]);
  });

  it('does not query catalog items when no source is enabled', async () => {
    expect(await loadProspectingCatalogOffers([])).toEqual([]);
    expect(remote.from).not.toHaveBeenCalled();
  });
});
