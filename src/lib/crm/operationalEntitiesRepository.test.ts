import { beforeAll, describe, expect, it, vi } from 'vitest';

let mappers: typeof import('./operationalEntitiesRepository').operationalEntityMappers;

beforeAll(async () => {
  vi.stubEnv('VITE_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_PUBLIC_SUPABASE_ANON_KEY', 'test-public-key');
  ({ operationalEntityMappers: mappers } = await import('./operationalEntitiesRepository'));
});

describe('operationalEntityMappers', () => {
  it('restores a list only with its tenant-owned relation members', () => {
    const list = mappers.rowToList({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Tecnologia SP',
      status: 'pending',
      criteria: { segmento: 'Tecnologia', cidade: 'São Paulo', estado: 'SP', fonte: 'Importação' },
      created_at: '2026-08-26T12:00:00.000Z',
    }, ['22222222-2222-4222-8222-222222222222']);
    expect(list.status).toBe('pendente');
    expect(list.total).toBe(1);
    expect(list.leadIds).toHaveLength(1);
  });

  it('maps a controlled outreach sequence without any provider configuration', () => {
    const flow = mappers.rowToFlow({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Boas-vindas',
      active: true,
      trigger_key: 'novo_lead',
      description: 'Contato inicial.',
    }, [{
      id: '44444444-4444-4444-8444-444444444444',
      sequence_id: '33333333-3333-4333-8333-333333333333',
      channel: 'whatsapp',
      content: 'Olá, {nome}.',
      delay_minutes: 0,
      order_index: 0,
    }]);
    expect(flow.ativo).toBe(true);
    expect(flow.passos[0].mensagem).toContain('{nome}');
  });

  it('counts actual list members instead of a historical prospecting total', () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Lista antiga', status: 'pending' as const,
      criteria: { total: 5 }, created_at: '2026-09-23T12:00:00.000Z',
    };
    expect(mappers.rowToList(row, []).total).toBe(0);
    expect(mappers.rowToList(row, ['22222222-2222-4222-8222-222222222222']).total).toBe(1);
  });
});
