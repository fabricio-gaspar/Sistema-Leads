import type { AgendaAppointment } from './appointmentsRepository';

/** Rejects DST gaps/overlaps instead of silently choosing a different wall clock. */
export function agendaWallClockToUtc(date: string, time: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('appointment_datetime_invalid');
  const desired = Date.parse(`${date}T${time}:00.000Z`);
  if (!Number.isFinite(desired) || new Date(desired).toISOString().slice(0, 10) !== date) throw new Error('appointment_datetime_invalid');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const wallTime = (instant: number) => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00.000Z`);
  };
  const offsets = new Set<number>();
  for (let hour = -48; hour <= 48; hour += 6) { const instant = desired + hour * 3_600_000; offsets.add(wallTime(instant) - instant); }
  const candidates = [...offsets].map((offset) => desired - offset).filter((instant) => wallTime(instant) === desired);
  if (candidates.length !== 1) throw new Error(candidates.length ? 'appointment_time_ambiguous' : 'appointment_time_nonexistent');
  return new Date(candidates[0]).toISOString();
}

export interface NextActionIntent { requestId: string; title: string; date: string; time: string; durationMinutes: number; allowConflict: boolean; }
export function prepareAgendaNextAction(parent: AgendaAppointment, intent: NextActionIntent): AgendaAppointment {
  if (!intent.title.trim() || intent.title.trim().length > 240 || !Number.isInteger(intent.durationMinutes) || intent.durationMinutes < 1 || intent.durationMinutes > 1440) throw new Error('appointment_next_action_invalid');
  const startsAt = agendaWallClockToUtc(intent.date, intent.time, parent.timezone);
  return { ...parent, id: intent.requestId, title: intent.title.trim(), startsAt,
    endsAt: new Date(Date.parse(startsAt) + intent.durationMinutes * 60_000).toISOString(),
    status: 'pending', confirmationStatus: 'pending', origin: 'manual', provider: null, externalId: null,
    result: '', notes: '', cancelReason: '', noShowReason: '', reminderStatus: 'not_scheduled',
    nextActionAt: null, nextActionTitle: null, isOverdue: false };
}

export function agendaNextActionError(error: unknown): string {
  const code = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const messages: Record<string, string> = {
    appointment_datetime_invalid: 'Informe uma data e um horário válidos.',
    appointment_time_nonexistent: 'Esse horário não existe no fuso escolhido por mudança de horário de verão. Escolha outro.',
    appointment_time_ambiguous: 'Esse horário ocorre duas vezes no fuso escolhido. Escolha um horário sem ambiguidade.',
    appointment_next_action_invalid: 'Informe título e duração entre 1 e 1.440 minutos.',
    appointment_time_conflict: 'Já existe um compromisso nesse horário. Escolha outro ou confirme explicitamente a sobreposição.',
    appointment_concurrent_update: 'O compromisso original mudou. Feche este formulário e atualize a Agenda antes de tentar novamente.',
    appointment_responsible_inactive: 'O responsável não está ativo. Atualize o compromisso original.',
    appointment_not_found_or_forbidden: 'Você não tem acesso para criar essa próxima ação.',
    appointment_idempotency_conflict: 'Esta tentativa já foi registrada com outros dados. Atualize a Agenda para conferir o resultado.',
  };
  return messages[code] || 'Resultado não confirmado. Repita a confirmação original para consultar a mesma tentativa, sem criar outra ação.';
}
