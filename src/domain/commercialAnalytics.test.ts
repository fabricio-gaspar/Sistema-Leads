import { describe, expect, it } from 'vitest';
import type { Lead } from '@/mocks/leadsData';
import type { Proposta } from '@/mocks/propostasData';
import { analyticsWindow, buildCommercialAnalytics, dateKey, initialAnalyticsFilters, isCommercialLead, percentage, proposalNet, variation, type ContactEvent, type StageEvent } from './commercialAnalytics';

const now = new Date('2026-09-27T15:00:00Z');
const lead = (id: string, patch: Partial<Lead> = {}): Lead => ({ id, nome: 'Contato de teste', empresa: 'Empresa de teste', cnpj: '', email: '', telefone: '', whatsapp: '', segmento: 'Serviços', cidade: '', estado: '', porte: '', score: 0, temperatura: 'Frio', etapa: 'Novo', origem: 'Importação', responsavel: 'Responsável de teste', tags: [], ultimaInteracao: '', criadoEm: '2026-09-25', modoAtendimento: 'HUMANO', responsavelId: 'owner-test', contactApprovalStatus: 'pending', aguardandoAtivacao: true, ...patch });
const proposal = (id: string, patch: Partial<Proposta> = {}): Proposta => ({ id, numero: id, lead: 'Contato de teste', leadId: '1', empresa: 'Empresa de teste', valor: 1000, descontoPct: 10, status: 'enviada', data: '2026-09-25', validade: '2026-10-01', responsavel: 'Responsável de teste', canal: 'Manual', itens: [], versao: 1, ...patch });
const analyse = (leads: Lead[], proposals: Proposta[] = [], events: StageEvent[] = [], contacts: ContactEvent[] = []) => buildCommercialAnalytics(leads, proposals, initialAnalyticsFilters, events, contacts, now);

describe('commercial analytics: population and denominators', () => {
  it('keeps found/unassigned leads out of the portfolio even with approved contact', () => {
    const result = analyse([lead('1', { responsavelId: '', contactApprovalStatus: 'approved' }), lead('2', { modoAtendimento: undefined })]);
    expect(result.cohort).toHaveLength(2); expect(result.pending).toHaveLength(2); expect(result.pipeline).toHaveLength(0); expect(result.conversion).toBeNull();
  });
  it('retains the assigned manual lead with contact pending, matching Kanban', () => {
    expect(isCommercialLead(lead('1'))).toBe(true); expect(analyse([lead('1')]).pipeline).toHaveLength(1);
  });
  it('excludes archived records in every calculation', () => {
    const result = analyse([lead('1', { arquivado: true, etapa: 'Ganho' })], [proposal('p')]);
    expect(result.cohort).toHaveLength(0); expect(result.expectedValue).toBe(0); expect(result.stages.every((stage) => stage.value === 0)).toBe(true);
  });
  it('has no percentage or infinite comparison with denominator zero', () => {
    expect(percentage(0, 0)).toBeNull(); expect(variation(2, 0)).toBeNull(); expect(percentage(0, 10)).toBe(0); expect(variation(0, 2)).toBe(-100);
  });
  it('counts won and lost as distinct terminal outcomes', () => {
    const result = analyse([lead('1', { etapa: 'Ganho' }), lead('2', { etapa: 'Perdido' }), lead('3')]);
    expect(result.conversion).toBeCloseTo(100 / 3); expect(result.active).toHaveLength(1); expect(result.stages.find((stage) => stage.stage === 'lost')?.value).toBe(1);
  });
  it('applies all dimensions consistently, including report segment', () => {
    const result = buildCommercialAnalytics([lead('1'), lead('2', { segmento: 'Varejo' })], [], { ...initialAnalyticsFilters, segment: 'Serviços', owner: 'Responsável de teste', origin: 'Importação', stage: 'entered' }, [], [], now);
    expect(result.cohort.map((item) => item.id)).toEqual(['1']);
  });
});

describe('commercial analytics: dates and values', () => {
  it('uses exactly seven inclusive days and a disjoint previous window', () => {
    expect(analyticsWindow('7', now)).toEqual({ start: '2026-09-21', end: '2026-09-27', previousStart: '2026-09-14', previousEnd: '2026-09-20', length: 7 });
  });
  it('preserves São Paulo day boundaries while keeping legacy date-only records valid', () => {
    expect(dateKey('2026-09-27T01:00:00Z')).toBe('2026-09-26'); expect(dateKey('2026-09-27')).toBe('2026-09-27');
    const result = analyse([lead('1', { criadoEm: '2026-09-27', createdAt: '2026-09-27T01:00:00Z' })]);
    expect(result.days.find((point) => point.key === '2026-09-26')?.encontrados).toBe(1);
  });
  it('supports the existing year-to-date filter, including leap years', () => {
    expect(analyticsWindow('year', new Date('2024-12-31T15:00:00Z')).length).toBe(366);
  });
  it('rounds net values in cents and applies discount once', () => {
    expect(proposalNet(proposal('p'))).toBe(900); expect(proposalNet(proposal('p', { valor: 19.99, descontoPct: 12.5 }))).toBe(17.49);
  });
  it('excludes draft/pending proposals from expected value; accepted is separate', () => {
    const result = analyse([lead('1')], [proposal('sent'), proposal('draft', { status: 'rascunho' }), proposal('pending', { status: 'aguardando_aprovacao' }), proposal('accepted', { status: 'aceita' })]);
    expect(result.expectedValue).toBe(900); expect(result.acceptedValue).toBe(900); expect(result.openProposals).toHaveLength(1);
  });
  it('includes proposals created in the period for older assigned leads', () => {
    const result = analyse([lead('1', { criadoEm: '2026-01-01' })], [proposal('p')]);
    expect(result.pipeline).toHaveLength(0); expect(result.expectedValue).toBe(900);
  });
});

describe('commercial analytics: events', () => {
  it('does not count queued, failed, draft or internal messages as accepted', () => {
    const contacts: ContactEvent[] = ['queued', 'failed', 'draft', 'internal', 'sent', 'received'].map((type) => ({ id: type, lead_id: '1', sender: type === 'received' ? 'lead' : 'seller', type, created_at: '2026-09-25T12:00:00Z', sent_at: type === 'sent' ? '2026-09-25T12:00:00Z' : null }));
    const point = analyse([lead('1')], [], [], contacts).days.find((day) => day.key === '2026-09-25');
    expect(point?.enviadas).toBe(1); expect(point?.recebidas).toBe(1);
  });
  it('never reconstructs stage conversion from the current stage', () => {
    expect(analyse([lead('1', { etapa: 'Ganho' })]).progression.every((stage) => stage.rate === null)).toBe(true);
  });
  it('deduplicates observed progression and ignores ambiguous legacy closure', () => {
    const events: StageEvent[] = [
      { id: 'a', lead_id: '1', from_stage: 'novo', to_stage: 'apresentado', created_at: '2026-09-25T12:00:00Z' },
      { id: 'b', lead_id: '1', from_stage: 'novo', to_stage: 'apresentado', created_at: '2026-09-25T13:00:00Z' },
      { id: 'c', lead_id: '1', from_stage: 'orcamento', to_stage: 'fechado', created_at: '2026-09-26T12:00:00Z' },
    ];
    const result = analyse([lead('1')], [], events);
    expect(result.progression[0]).toMatchObject({ base: 1, advanced: 1 });
    expect(result.progression[4]).toMatchObject({ base: 1, advanced: 0 });
  });
});
