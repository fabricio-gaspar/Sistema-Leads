import { beforeAll, describe, expect, it, vi } from 'vitest';

let mappers: typeof import('./proposalsRepository').proposalMappers;

beforeAll(async () => {
  vi.stubEnv('VITE_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', 'test-public-key');
  ({ proposalMappers: mappers } = await import('./proposalsRepository'));
});

describe('proposalMappers', () => {
  it('restores a tenant proposal from the published operational schema', () => {
    const proposal = mappers.proposalRowToProposal({
      id: '11111111-1111-4111-8111-111111111111',
      number: 'PRP-20260826-ABC123',
      lead_id: '33333333-3333-4333-8333-333333333333',
      client: 'Empresa Exemplo',
      status: 'pending_approval',
      value: '2500.00',
      discount: '12.5',
      creator: 'user',
      creator_name: 'Ana',
      owner_id: null,
      need_approval: true,
      created_at: '2026-08-26T12:00:00.000Z',
      updated_at: null,
      items: {
        lines: [{ id: '44444444-4444-4444-8444-444444444444', nome: 'Consultoria', quantidade: 2, preco: 1250 }],
        metadata: { responsavel: 'Ana', canal: 'WhatsApp', bloqueadaEnvio: true, validade: '2026-09-10' },
      },
    }, { id: '33333333-3333-4333-8333-333333333333', contact: 'Carla', company: 'Empresa Exemplo' });

    expect(proposal.status).toBe('aguardando_aprovacao');
    expect(proposal.leadId).toBe('33333333-3333-4333-8333-333333333333');
    expect(proposal.valor).toBe(2500);
    expect(proposal.itens[0]).toMatchObject({ nome: 'Consultoria', quantidade: 2, preco: 1250 });
  });

  it('generates proposal numbers that are unique-format and database-valid', () => {
    const number = mappers.newProposalNumber(new Date('2026-08-26T12:00:00.000Z'), () => 'abcdef12-3456-7890-abcd-ef1234567890');
    expect(number).toBe('PRP-20260826-ABCDEF');
  });
});
