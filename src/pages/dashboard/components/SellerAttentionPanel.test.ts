import { describe, expect, it } from 'vitest';
import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';
import { buildSellerAttentionGroups } from './sellerAttention';

const notification = (id: string, tipo: string, leadId: string, extra: Partial<Notificacao> = {}): Notificacao => ({
  id, tipo, leadId, titulo: id, descricao: `Detalhe ${id}`, lida: false,
  data: '2026-09-26T12:00:00.000Z', status: 'open', ...extra,
});

const lead = (id: string, extra: Partial<Lead> = {}): Lead => ({
  id, nome: id, empresa: `Empresa ${id}`, etapa: 'Qualificando',
  ...extra,
} as Lead);

describe('buildSellerAttentionGroups', () => {
  it('keeps meetings, quotes and hot leads in their semantic lanes', () => {
    const groups = buildSellerAttentionGroups([
      notification('meeting', 'MEETING', 'lead-1', { acaoNecessaria: true, prioridade: 'high' }),
      notification('quote', 'QUOTE', 'lead-2', { acaoNecessaria: true, prioridade: 'high' }),
      notification('hot', 'HOT', 'lead-3', { acaoNecessaria: true, prioridade: 'high' }),
      notification('human', 'HANDOFF', 'lead-4', { acaoNecessaria: true, prioridade: 'urgent' }),
    ], [], new Date('2026-09-26T15:00:00.000Z'));

    expect(groups.find((group) => group.id === 'commercial')?.items.map((item) => item.id)).toEqual(['meeting', 'quote']);
    expect(groups.find((group) => group.id === 'hot')?.items.map((item) => item.id)).toEqual(['hot']);
    expect(groups.find((group) => group.id === 'now')?.items.map((item) => item.id)).toEqual(['human']);
  });

  it('does not repeat a lead across notification, follow-up and stale lanes', () => {
    const groups = buildSellerAttentionGroups(
      [notification('reply', 'REPLY', 'lead-1', { acaoNecessaria: true })],
      [
        lead('lead-1', { nextFollowUpAt: '2026-09-26T18:00:00.000Z', timeoutAt: '2026-09-25T12:00:00.000Z' }),
        lead('lead-2', { nextFollowUpAt: '2026-09-26T18:00:00.000Z', timeoutAt: '2026-09-25T12:00:00.000Z' }),
      ],
      new Date('2026-09-26T15:00:00.000Z'),
    );

    const allIds = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(allIds).toEqual(['reply', 'lead-2']);
    expect(groups.find((group) => group.id === 'stale')).toBeUndefined();
  });
});
