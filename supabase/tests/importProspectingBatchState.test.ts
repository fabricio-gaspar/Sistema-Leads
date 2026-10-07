import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leadToCrmRow } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

const migration = readFileSync(
  new URL('../migrations/20261006011920_fix_prospecting_batch_state.sql', import.meta.url),
  'utf8',
);

const lead = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Contato de teste', empresa: 'Empresa de teste', cnpj: '', email: '', telefone: '', whatsapp: '',
  segmento: 'Indústria', cidade: 'São Paulo', estado: 'SP', porte: '', score: 80, temperatura: 'Morno',
  etapa: 'Novo', origem: 'Apify', responsavel: 'Ana (IA)', tags: [], ultimaInteracao: '—', criadoEm: '2026-10-06',
} satisfies Lead;

describe('import_prospecting_batch — contrato do estado', () => {
  it('aceita e persiste a UF produzida pelo mapeador de leads', () => {
    expect(leadToCrmRow(lead, '22222222-2222-4222-8222-222222222222').uf).toBe('SP');
    expect(migration).toContain("'city','uf','size'");
    expect(migration).toContain('active_channel, city, uf, size, source_record_id');
    expect(migration).toContain('v_lead.active_channel, v_lead.city, v_lead.uf, v_lead.size, v_lead.source_record_id');
  });

  it('mantém a RPC invocadora, a permissão mínima e a validação fechada do lote', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain("private.has_org_permission(v_org, v_actor, 'leads.create')");
    expect(migration).toContain("raise exception 'prospecting_import_invalid_lead_fields' using errcode = '22023'");
    expect(migration).toContain('revoke all on function public.import_prospecting_batch(uuid, jsonb, text, jsonb) from public, anon');
    expect(migration).toContain('grant execute on function public.import_prospecting_batch(uuid, jsonb, text, jsonb) to authenticated');
  });
});
