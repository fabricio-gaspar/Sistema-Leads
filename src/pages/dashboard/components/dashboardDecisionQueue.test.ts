import { describe, expect, it } from 'vitest';
import type { Notificacao } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';
import { buildDashboardDecisionQueue } from './dashboardDecisionQueue';

const notification = (id: string, tipo: string, leadId: string, extra: Partial<Notificacao> = {}): Notificacao => ({
  id,
  tipo,
  leadId,
  titulo: id,
  descricao: `Detalhe ${id}`,
  lida: false,
  data: '2026-09-26T12:00:00.000Z',
  status: 'open',
  ...extra,
});

const lead = (id: string, extra: Partial<Lead> = {}): Lead => ({
  id,
  nome: `Contato ${id}`,
  empresa: `Empresa ${id}`,
  etapa: 'Qualificando',
  ...extra,
} as Lead);

describe('buildDashboardDecisionQueue', () => {
  it('inclui handoff humano sem notificação e conserva a prioridade comercial', () => {
    const queue = buildDashboardDecisionQueue(
      [
        notification('quote', 'QUOTE', 'quote'),
        notification('hot', 'HOT', 'hot'),
      ],
      [
        lead('quote'),
        lead('hot'),
        lead('human', { modoAtendimento: 'HUMANO' }),
      ],
      new Date('2026-09-26T15:00:00.000Z'),
    );

    expect(queue.map((item) => item.title)).toEqual(['Empresa human', 'Empresa quote', 'Empresa hot']);
    expect(queue[0]).toMatchObject({ group: 'Atendimento humano', action: 'Assumir atendimento' });
  });

  it('não repete o mesmo lead quando já há uma notificação aberta de handoff', () => {
    const queue = buildDashboardDecisionQueue(
      [notification('handoff', 'HANDOFF', 'human', { acaoNecessaria: true, prioridade: 'urgent' })],
      [lead('human', { modoAtendimento: 'HUMANO' })],
      new Date('2026-09-26T15:00:00.000Z'),
    );

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: 'now:handoff', group: 'Responder agora' });
  });

  it('deduplica por lead e limita a fila a cinco decisões', () => {
    const leads = ['one', 'two', 'three', 'four', 'five', 'six'].map((id) => lead(id));
    const queue = buildDashboardDecisionQueue(
      [
        notification('one-hot', 'HOT', 'one'),
        notification('one-quote', 'QUOTE', 'one'),
        ...['two', 'three', 'four', 'five', 'six'].map((id) => notification(`quote-${id}`, 'QUOTE', id)),
      ],
      leads,
      new Date('2026-09-26T15:00:00.000Z'),
    );

    expect(queue).toHaveLength(5);
    expect(new Set(queue.map((item) => item.leadId)).size).toBe(5);
    expect(queue.map((item) => item.leadId)).toEqual(['one', 'two', 'three', 'four', 'five']);
  });
});
