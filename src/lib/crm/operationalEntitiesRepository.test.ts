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

  it('maps a controlled campaign without any provider configuration', () => {
    const flow = mappers.rowToFlow({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Boas-vindas',
      status: 'active',
      channel: 'mixed',
      cadence: [{ id: 'step-1', diasApos: 0, canal: 'WhatsApp', mensagem: 'Olá, {nome}.' }],
      metadata: { gatilho: 'novo_lead', descricao: 'Contato inicial.' },
    });
    expect(flow.ativo).toBe(true);
    expect(flow.passos[0].mensagem).toContain('{nome}');
  });
});
