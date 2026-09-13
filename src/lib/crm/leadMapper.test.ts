import { describe, expect, it } from 'vitest';
import { crmRowToLead, leadToCrmRow } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

const lead: Lead = {
  id: '11111111-1111-4111-8111-111111111111', nome: 'Ana Souza', empresa: 'Empresa Exemplo', cnpj: '12.345.678/0001-90',
  email: 'ANA@EXEMPLO.COM', telefone: '11999990000', whatsapp: '11999990000', segmento: 'Tecnologia', cidade: 'São Paulo', estado: 'SP',
  porte: 'Médio', score: 91, temperatura: 'Quente', etapa: 'Qualificando', origem: 'Importação CSV', responsavel: 'Ana (IA)',
  tags: ['prioridade'], ultimaInteracao: 'agora', criadoEm: '2026-08-26',
};

describe('leadMapper', () => {
  it('converte campos do domínio operacional para a tabela de leads protegida por organização', () => {
    const row = leadToCrmRow(lead, '22222222-2222-4222-8222-222222222222');
    expect(row.organization_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(row.email).toBe('ana@exemplo.com');
    expect(row.stage).toBe('Qualificado');
    expect(row.source_metadata?.cidade).toBeUndefined();
  });

  it('mapeia opt-out e pausa da Ana para o lead da interface', () => {
    const row = leadToCrmRow(lead, '22222222-2222-4222-8222-222222222222');
    const mapped = crmRowToLead({
      ...row,
      id: row.id!, contact: row.contact ?? null, email: row.email ?? null, phone: row.phone ?? null, whatsapp: row.whatsapp ?? null,
      segment: row.segment ?? null, score: row.score ?? 0, temp: row.temp ?? null, stage: row.stage ?? 'Prospecção', origin: row.origin ?? null,
      owner: row.owner ?? null, assigned_to: null, opt_out: true, ai_paused: true, automation_status: 'human', active_channel: null,
      city: row.city ?? null, size: row.size ?? null, source_metadata: row.source_metadata ?? {},
      created_at: '2026-08-26T12:00:00.000Z', updated_at: '2026-08-26T12:00:00.000Z',
    });
    expect(mapped.bloqueado).toBe(true);
    expect(mapped.modoAtendimento).toBe('HUMANO');
  });

  it('persiste o modo, o responsável e a etapa rígida da Ana', () => {
    const row = leadToCrmRow({ ...lead, etapa: 'Reunião', modoAtendimento: 'IA', responsavelId: '33333333-3333-4333-8333-333333333333' }, '22222222-2222-4222-8222-222222222222');
    expect(row.ana_stage).toBe('reuniao');
    expect(row.modo_atendimento).toBe('ia');
    expect(row.owner_id).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('mantém contato sem autorização como pendente sem confundir com opt-out', () => {
    const row = leadToCrmRow({ ...lead, contatoPermitido: false, contactApprovalStatus: 'pending', whatsapp: '' }, '22222222-2222-4222-8222-222222222222');
    expect(row).toMatchObject({ contact_approval_status: 'pending', automation_status: 'pending_approval', opt_out: false, whatsapp: null });
  });

  it('persiste pontuação explicável e origem rastreável', () => {
    const row = leadToCrmRow({ ...lead, fitScore: 84, contactabilityScore: 55, engagementScore: 0, sourceRecordId: 'place-123', sourceUrl: 'https://example.invalid/place', scoreExplanation: 'atividade e região compatíveis' }, '22222222-2222-4222-8222-222222222222');
    expect(row).toMatchObject({ source_record_id: 'place-123', score_snapshot: { fit: 84, contactability: 55, engagement: 0 }, score_explanation: 'atividade e região compatíveis' });
  });
});
