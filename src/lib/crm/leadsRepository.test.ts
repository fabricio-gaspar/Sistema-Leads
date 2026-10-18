import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertLeadUpdatePersisted } from './leadsRepository';

const remote = vi.hoisted(() => ({
  leadRows: [] as Array<Record<string, unknown>>,
  policyLeadIdBatches: [] as string[][],
  policyOrganizationFilters: [] as string[],
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: remote.from } }));

function leadRow(id: string, sourceMetadata: Record<string, unknown> = {}) {
  return {
    id,
    organization_id: 'organization-1',
    company: `Empresa ${id}`,
    contact: `Contato ${id}`,
    email: null,
    phone: '+5511999999999',
    whatsapp: '+5511999999999',
    segment: null,
    score: 50,
    temp: 'warm',
    stage: 'Novo',
    origin: 'whatsapp',
    owner: 'ia',
    assigned_to: null,
    opt_out: false,
    ai_paused: false,
    automation_status: 'pending_approval',
    active_channel: 'whatsapp',
    city: null,
    size: null,
    source_metadata: sourceMetadata,
    created_at: '2026-10-14T12:00:00.000Z',
    updated_at: '2026-10-14T12:00:00.000Z',
  };
}

beforeEach(() => {
  remote.leadRows.splice(0);
  remote.policyLeadIdBatches.splice(0);
  remote.policyOrganizationFilters.splice(0);
  remote.from.mockReset();
  remote.from.mockImplementation((table: string) => {
    const rows = table === 'leads' ? remote.leadRows : [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => {
        if (table === 'lead_handoff_policies' && column === 'organization_id') remote.policyOrganizationFilters.push(value);
        return query;
      }),
      in: vi.fn((_column: string, ids: string[]) => {
        remote.policyLeadIdBatches.push(ids);
        return query;
      }),
      order: vi.fn(() => query),
      range: vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null })),
    };
    return query;
  });
});

describe('assertLeadUpdatePersisted', () => {
  it('rejects an update that did not return the expected lead', () => {
    expect(() => assertLeadUpdatePersisted(null, 'lead-1')).toThrow('lead_update_not_persisted');
    expect(() => assertLeadUpdatePersisted({ id: 'another-lead' }, 'lead-1')).toThrow('lead_update_not_persisted');
  });

  it('accepts the persisted lead returned by Supabase', () => {
    expect(() => assertLeadUpdatePersisted({ id: 'lead-1' }, 'lead-1')).not.toThrow();
  });

  it('keeps WA-AKG contact-only shells out of commercial leads while loading policies once per organization', async () => {
    const { loadOperationalLeads } = await import('./leadsRepository');
    remote.leadRows.push(
      leadRow('lead-commercial'),
      leadRow('lead-central-only', { wa_akg_contact_only: true }),
    );

    const leads = await loadOperationalLeads('organization-1');

    expect(leads.map((lead) => lead.id)).toEqual(['lead-commercial']);
    expect(remote.policyLeadIdBatches).toEqual([]);
    expect(remote.policyOrganizationFilters).toEqual(['organization-1']);
  });
});
