import { describe, expect, it } from 'vitest';
import { crmRowToLead, leadToCrmRow } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

const lead: Lead = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Ana Souza',
  empresa: 'Empresa Exemplo',
  cnpj: '12.345.678/0001-90',
  email: 'ANA@EXEMPLO.COM',
  telefone: '11999990000',
  whatsapp: '11999990000',
  segmento: 'Tecnologia',
  cidade: 'São Paulo',
  estado: 'SP',
  porte: 'Médio',
  score: 91,
  temperatura: 'Quente',
  etapa: 'Em Qualificação',
  origem: 'Importação CSV',
  responsavel: 'Ana (IA)',
  tags: ['prioridade'],
  ultimaInteracao: 'agora',
  criadoEm: '2026-08-26',
  consentimentoEmail: true,
};

describe('leadMapper', () => {
  it('preserves tenant fields and consent without placing them in browser-only state', () => {
    const row = leadToCrmRow(lead, '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333');
    expect(row.organization_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(row.primary_email).toBe('ana@exemplo.com');
    expect(row.consent_status).toBe('opted_in');
    expect(row.metadata?.cidade).toBe('São Paulo');
  });

  it('maps opt-out rows back to a blocked lead', () => {
    const row = leadToCrmRow(lead, '22222222-2222-4222-8222-222222222222');
    const mapped = crmRowToLead({
      id: row.id!,
      organization_id: row.organization_id,
      owner_id: null,
      company_name: row.company_name,
      primary_contact_name: row.primary_contact_name ?? null,
      primary_email: row.primary_email ?? null,
      primary_phone: row.primary_phone ?? null,
      segment: row.segment ?? null,
      lifecycle_stage: row.lifecycle_stage ?? 'Novo',
      score: row.score ?? 0,
      source: row.source ?? null,
      consent_status: 'opted_out',
      metadata: row.metadata ?? {},
      created_at: '2026-08-26T12:00:00.000Z',
      updated_at: '2026-08-26T12:00:00.000Z',
      is_archived: false,
    });
    expect(mapped.bloqueado).toBe(true);
    expect(mapped.contatoPermitido).toBe(false);
  });
});
