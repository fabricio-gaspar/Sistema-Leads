import type { Conversa } from '@/mocks/atendimentoData';

const WINDOW_HOURS = 24;

export type ConversationRealtimeState = 'connecting' | 'live' | 'unavailable';

export interface ConversationActivityPoint {
  timestamp: number;
  label: string;
  recebidas: number;
  enviadas: number;
  total: number;
}

function hourStart(date: Date): Date {
  const result = new Date(date);
  result.setMinutes(0, 0, 0);
  return result;
}

function hourLabel(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

/** Produz a série a partir do histórico operacional carregado pela Central. */
export function buildConversationActivity(conversas: Conversa[], now = new Date()): ConversationActivityPoint[] {
  const currentHour = hourStart(now);
  const firstHour = new Date(currentHour);
  firstHour.setHours(firstHour.getHours() - (WINDOW_HOURS - 1));
  const points = new Map<number, ConversationActivityPoint>();

  for (let cursor = new Date(firstHour); cursor <= currentHour; cursor.setHours(cursor.getHours() + 1)) {
    const timestamp = cursor.getTime();
    points.set(timestamp, { timestamp, label: hourLabel(timestamp), recebidas: 0, enviadas: 0, total: 0 });
  }

  for (const conversa of conversas) {
    for (const mensagem of conversa.mensagens) {
      if (mensagem.notaInterna || !mensagem.criadoEm) continue;
      const sentAt = new Date(mensagem.criadoEm);
      if (Number.isNaN(sentAt.getTime()) || sentAt < firstHour || sentAt > now) continue;
      const point = points.get(hourStart(sentAt).getTime());
      if (!point) continue;
      if (mensagem.autor === 'cliente') point.recebidas += 1;
      else point.enviadas += 1;
      point.total += 1;
    }
  }

  return [...points.values()];
}
