import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lead } from '@/mocks/leadsData';
import { importProspectingBatch, importProspectingBulkBatch } from './prospectingBatchRepository';

const { rpc, assertOrganizationSession } = vi.hoisted(() => ({ rpc: vi.fn(), assertOrganizationSession: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/lib/organizationSession', () => ({
  assertOrganizationSession,
  resolveOrganizationSession: () => Promise.resolve({
    organizationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
  }),
}));
vi.mock('@/lib/crm/leadMapper', () => ({
  isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value),
  leadToCrmRow: (lead: Lead, organizationId: string) => ({
    id: lead.id,
    organization_id: organizationId,
    company: lead.empresa,
  }),
}));

const input = {
  batchId: '33333333-3333-4333-8333-333333333333',
  leads: [{ id: '44444444-4444-4444-8444-444444444444', empresa: 'Empresa QA' } as Lead],
  listName: 'Lista QA',
  listCriteria: { segmento: '', cidade: 'São Paulo', estado: 'SP', fonte: 'Apify' },
};

describe('importProspectingBatch', () => {
  beforeEach(() => {
    rpc.mockReset();
    assertOrganizationSession.mockReset();
  });

  it('sends the whole reviewed batch through one authenticated RPC call', async () => {
    const result = { listId: input.batchId, leadIds: [input.leads[0].id], alreadyImported: false };
    rpc.mockResolvedValue({ data: result, error: null });

    await expect(importProspectingBatch(input)).resolves.toEqual({ ...result, duplicateCount: 0 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('import_prospecting_batch', {
      p_batch_id: input.batchId,
      p_leads: [{ id: input.leads[0].id, organization_id: '11111111-1111-4111-8111-111111111111', company: 'Empresa QA' }],
      p_list_name: input.listName,
      p_list_criteria: input.listCriteria,
    });
  });

  it('propagates a rejected batch without reporting success', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });
    await expect(importProspectingBatch(input)).rejects.toMatchObject({ code: '23505' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('uses the server-protected RPC for a file import', async () => {
    const bulkInput = { ...input, importGroupId: '55555555-5555-4555-8555-555555555555' };
    const result = { listId: input.batchId, leadIds: [input.leads[0].id], duplicateCount: 0, alreadyImported: false };
    rpc.mockResolvedValue({ data: result, error: null });

    await expect(importProspectingBulkBatch(bulkInput)).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith('import_prospecting_bulk_batch', expect.objectContaining({
      p_batch_id: input.batchId,
      p_import_group_id: bulkInput.importGroupId,
    }));
  });

  it('rejects a bulk response whose accepted and duplicate totals do not cover the batch', async () => {
    const bulkInput = { ...input, importGroupId: '55555555-5555-4555-8555-555555555555' };
    rpc.mockResolvedValue({ data: {
      listId: input.batchId,
      leadIds: [],
      duplicateCount: 0,
      alreadyImported: false,
    }, error: null });

    await expect(importProspectingBulkBatch(bulkInput)).rejects.toThrow('prospecting_import_result_unconfirmed');
  });

  it('stops before the RPC if a long import changes organization', async () => {
    assertOrganizationSession.mockImplementationOnce(() => { throw new Error('session_context_changed'); });
    await expect(importProspectingBatch(input, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      role: 'seller',
      context: {} as never,
    }))
      .rejects.toThrow('prospecting_import_organization_changed');
    expect(rpc).not.toHaveBeenCalled();
  });
});
