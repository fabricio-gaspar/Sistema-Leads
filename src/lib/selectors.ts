import type { Lead } from '@/mocks/leadsData';
import type { Proposta, Venda } from '@/mocks/propostasData';
import type { Conversa } from '@/mocks/atendimentoData';
import type { RegistroAuditoria } from '@/lib/tipos';

// Selectors derivados dos stores vivos — fonte única de métricas.

export function getLeadsPorEtapa(leads: Lead[]): Record<string, number> {
  return leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.etapa] = (acc[l.etapa] || 0) + 1;
    return acc;
  }, {});
}

export function getReceitaTotal(vendas: Venda[]): number {
  return vendas.filter((v) => v.status === 'pago').reduce((s, v) => s + v.valor, 0);
}

export function getReceitaPorPeriodo(vendas: Venda[], dias: number): number {
  const limite = Date.now() - dias * 86400000;
  return vendas
    .filter((v) => v.status === 'pago')
    .filter((v) => {
      const t = new Date(v.data + 'T00:00:00').getTime();
      return isNaN(t) || t >= limite;
    })
    .reduce((s, v) => s + v.valor, 0);
}

export function getConversasNaoLidas(conversas: Conversa[]): number {
  return conversas.reduce((s, c) => s + (c.naoLidas || 0), 0);
}

export function getLeadsQuentes(leads: Lead[]): Lead[] {
  return leads.filter((l) => l.score >= 80 && l.etapa !== 'Fechado — Ganho' && l.etapa !== 'Fechado — Perdido');
}

export function getLeadsSemPrimeiroContato(leads: Lead[]): Lead[] {
  return leads.filter((l) => !l.primeiroContatoEnviadoEm && l.etapa === 'Novo');
}

export function getLeadsEmTimeout(leads: Lead[]): Lead[] {
  const agora = Date.now();
  return leads.filter((l) => {
    if (!l.timeoutAt) return false;
    const t = new Date(l.timeoutAt).getTime();
    return !isNaN(t) && t <= agora && l.etapa !== 'Fechado — Perdido' && l.etapa !== 'Fechado — Ganho';
  });
}

export function getPropostasPorStatus(propostas: Proposta[]): Record<string, number> {
  return propostas.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
}

export function getMotivosPerda(propostas: Proposta[]): { motivo: string; quantidade: number }[] {
  const mapa = new Map<string, number>();
  propostas.forEach((p) => {
    if (p.status === 'recusada' && p.motivoPerda) {
      mapa.set(p.motivoPerda, (mapa.get(p.motivoPerda) || 0) + 1);
    }
  });
  return Array.from(mapa.entries())
    .map(([motivo, quantidade]) => ({ motivo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

export function getMetricasAna(leads: Lead[], auditoria: RegistroAuditoria[]): {
  atendidosIa: number;
  handoffs: number;
  optouts: number;
  respostasAutomaticas: number;
} {
  const handoffs = auditoria.filter((a) => a.evento === 'HANDOFF').length;
  const optouts = auditoria.filter((a) => a.evento === 'OPT_OUT').length;
  const respostasAutomaticas = auditoria.filter((a) => a.evento === 'MESSAGE_SENT').length;
  const atendidosIa = leads.filter((l) => (l.modoAtendimento ?? 'IA') === 'IA').length;
  return { atendidosIa, handoffs, optouts, respostasAutomaticas };
}

export function getContagemPorResponsavel(leads: Lead[]): { responsavel: string; quantidade: number; convertidos: number }[] {
  const mapa = new Map<string, { quantidade: number; convertidos: number }>();
  leads.forEach((l) => {
    const r = l.responsavel || '—';
    const atual = mapa.get(r) || { quantidade: 0, convertidos: 0 };
    atual.quantidade += 1;
    if (l.etapa === 'Fechado — Ganho') atual.convertidos += 1;
    mapa.set(r, atual);
  });
  return Array.from(mapa.entries())
    .map(([responsavel, v]) => ({ responsavel, ...v }))
    .sort((a, b) => b.quantidade - a.quantidade);
}