import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leadToCrmRow } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

const migration = readFileSync(
  new URL('../migrations/20261006011920_fix_prospecting_batch_state.sql', import.meta.url),
  'utf8',
);

const hardenedCsvMigration = readFileSync(
  new URL('../migrations/20261015160000_harden_prospecting_csv_import_dedupe.sql', import.meta.url),
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

  it('não revela nem vincula uma colisão de identidade fora da carteira do autor', () => {
    const reserveFunction = hardenedCsvMigration.slice(
      hardenedCsvMigration.indexOf('create or replace function private.reserve_prospecting_import_identity'),
      hardenedCsvMigration.indexOf('revoke all on function private.reserve_prospecting_import_identity'),
    );
    const membershipWrite = hardenedCsvMigration.indexOf('insert into public.lead_list_members');
    const accessFence = hardenedCsvMigration.indexOf('private.can_access_lead(p_organization_id, v_lead_id, v_actor)');

    expect(reserveFunction).toContain("raise exception 'prospecting_import_identity_conflict' using errcode = '42501'");
    expect(accessFence).toBeGreaterThan(-1);
    expect(accessFence).toBeLessThan(membershipWrite);
  });

  it('adia a FK da reserva e calcula a identidade forte no servidor', () => {
    expect(hardenedCsvMigration).toContain('on delete cascade deferrable initially deferred');
    expect(hardenedCsvMigration).toContain('v_whatsapp_identity := public.normalize_phone_identity(v_lead.whatsapp)');
    expect(hardenedCsvMigration).toContain('v_phone_identity := public.normalize_phone_identity(v_lead.phone)');
    expect(hardenedCsvMigration).toContain('v_lead.deduplication_key := v_identity_key');
    expect(hardenedCsvMigration).toContain('v_identity_key,');
  });
});
