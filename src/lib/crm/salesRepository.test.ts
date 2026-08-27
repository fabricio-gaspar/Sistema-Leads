import { beforeAll, describe, expect, it, vi } from 'vitest';

let mappers: typeof import('./salesRepository').saleMappers;

beforeAll(async () => {
  vi.stubEnv('VITE_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', 'test-public-key');
  ({ saleMappers: mappers } = await import('./salesRepository'));
});

describe('saleMappers', () => {
  it('maps a relational sale only through its proposal, opportunity and lead', () => {
    const sale = mappers.saleRowToVenda({
      id: '11111111-1111-4111-8111-111111111111',
      proposal_id: '22222222-2222-4222-8222-222222222222',
      amount: '3480.00',
      payment_method: 'PIX',
      payment_status: 'pending',
      receipt_number: null,
      created_at: '2026-08-26T12:00:00.000Z',
      crm_proposals: {
        number: 'PRP-20260826-ABC123',
        crm_opportunities: { crm_leads: { primary_contact_name: 'Carla', company_name: 'Empresa Exemplo' } },
      },
    });
    expect(sale).toMatchObject({ lead: 'Carla', empresa: 'Empresa Exemplo', valor: 3480, status: 'pendente' });
    expect(sale.comprovante).toBe('—');
  });

  it('keeps financial state names explicit in both directions', () => {
    expect(mappers.statusFromDb.refunded).toBe('estornado');
    expect(mappers.statusToDb.cancelado).toBe('cancelled');
  });
});
