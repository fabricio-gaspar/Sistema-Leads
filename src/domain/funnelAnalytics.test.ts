import { describe, expect, it } from 'vitest';
import type { Lead } from '@/mocks/leadsData';
import type { Proposta } from '@/mocks/propostasData';
import { buildFunnelAnalytics, initialFunnelFilters } from './funnelAnalytics';

const lead = (id: string): Lead => ({
  id, nome: 'Contato', empresa: 'Wayflex teste', cnpj: '', email: '', telefone: '', whatsapp: '', segmento: 'Indústria', cidade: 'São Paulo', estado: 'SP', porte: 'Médio', score: 80, temperatura: 'Morno', etapa: 'Apresentado', origem: 'Manual', responsavel: 'Você', responsavelId: 'user-1', modoAtendimento: 'IA', tags: [], ultimaInteracao: '', criadoEm: '2026-09-28', createdAt: '2026-09-28', arquivado: false,
});

const proposal = (id: string, version: number, status: Proposta['status']): Proposta => ({ id, numero: `ORC-${id}`, lead: 'Contato', leadId: 'lead-1', empresa: 'Wayflex teste', valor: 1000, status, validade: '2026-10-10', responsavel: 'Você', data: '2026-09-28', createdAt: '2026-09-28', canal: 'Central', itens: [], descontoPct: 0, versao: version, propostaPaiId: 'family-1' });

describe('funnel analytics', () => {
  it('deduplicates proposal revisions and does not infer conversion from an open portfolio', () => {
    const result = buildFunnelAnalytics(
      [lead('lead-1')],
      [proposal('old', 1, 'enviada'), proposal('new', 2, 'visualizada')],
      [{ id: 'event-1', lead_id: 'lead-1', from_stage: 'entered', to_stage: 'engaging', created_at: '2026-09-28T12:00:00Z' }],
      initialFunnelFilters,
      new Date('2026-09-29T12:00:00Z'),
    );

    expect(result.captured).toHaveLength(1);
    expect(result.portfolio).toHaveLength(1);
    expect(result.activeProposals).toHaveLength(1);
    expect(result.expectedValue).toBe(1000);
    expect(result.conversion).toBeNull();
    expect(result.stageCounts.find((stage) => stage.stage === 'engaging')?.leads).toBe(1);
  });
});
