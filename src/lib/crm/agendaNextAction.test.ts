import { describe, expect, it, vi } from 'vitest';
import { agendaNextActionError, agendaWallClockToUtc, prepareAgendaNextAction } from './agendaNextAction';
import type { AgendaAppointment } from './appointmentsRepository';

const parent = { id: 'aaaaaaaa-0000-4000-8000-000000000010', leadId: 'aaaaaaaa-0000-4000-8000-000000000001',
  timezone: 'America/Sao_Paulo', provider: 'google', externalId: 'external-parent', reminderStatus: 'sent',
  nextActionAt: '2026-10-07', nextActionTitle: 'old', notes: 'old notes' } as AgendaAppointment;
const intent = { requestId: 'aaaaaaaa-0000-4000-8000-000000000011', title: 'Retomar conversa', date: '2026-10-06', time: '10:00', durationMinutes: 30, allowConflict: false };

describe('Agenda R9 — próxima ação com duração e fuso explícitos', () => {
  it('converte São Paulo e cria intervalo positivo, sem herdar identidade externa/entrega', () => {
    expect(prepareAgendaNextAction(parent, intent)).toMatchObject({ id: intent.requestId, leadId: parent.leadId,
      startsAt: '2026-10-06T13:00:00.000Z', endsAt: '2026-10-06T13:30:00.000Z', provider: null, externalId: null,
      reminderStatus: 'not_scheduled', status: 'pending', origin: 'manual', nextActionAt: null, nextActionTitle: null, notes: '' });
  });
  it('duração atravessa meia-noite sem ficar negativa', () => {
    expect(prepareAgendaNextAction(parent, { ...intent, time: '23:45', durationMinutes: 60 })).toMatchObject({
      startsAt: '2026-10-07T02:45:00.000Z', endsAt: '2026-10-07T03:45:00.000Z' });
  });
  it.each([0, -1, 1.5, 1441, NaN])('recusa duração %s', (durationMinutes) => {
    expect(() => prepareAgendaNextAction(parent, { ...intent, durationMinutes })).toThrow('appointment_next_action_invalid');
  });
  it.each([['2026-02-30', '10:00'], ['2026-10-06', '24:00'], ['', '10:00'], ['2026-01-01', '9:00']])('recusa calendário inválido %s %s', (date, time) => {
    expect(() => agendaWallClockToUtc(date, time, parent.timezone)).toThrow('appointment_datetime_invalid');
  });
  it('recusa horário inexistente no início do DST', () => {
    expect(() => agendaWallClockToUtc('2026-03-08', '02:30', 'America/New_York')).toThrow('appointment_time_nonexistent');
  });
  it('recusa horário ambíguo no fim do DST', () => {
    expect(() => agendaWallClockToUtc('2026-11-01', '01:30', 'America/New_York')).toThrow('appointment_time_ambiguous');
  });
  it('aceita horários inequívocos em ambos os lados do DST', () => {
    expect(agendaWallClockToUtc('2026-03-08', '01:30', 'America/New_York')).toBe('2026-03-08T06:30:00.000Z');
    expect(agendaWallClockToUtc('2026-03-08', '03:30', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
  });
  it('falha desconhecida não afirma ausência de gravação', () => {
    expect(agendaNextActionError(new Error('network'))).toContain('Resultado não confirmado');
    expect(agendaNextActionError({ message: 'appointment_time_conflict' })).toContain('sobreposição');
  });
});

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/lib/organizationSession', () => ({ resolveOrganizationSession: async () => ({ organizationId: 'org-a', userId: 'user-a' }), assertOrganizationSession: vi.fn() }));

describe('Agenda R9 — repository atômico (transporte simulado)', () => {
  it('usa uma RPC, mantendo requestId para repetir resultado incerto', async () => {
    const { createAgendaNextAction } = await import('./appointmentsRepository');
    rpc.mockResolvedValue({ data: { id: intent.requestId, organization_id: 'org-a' }, error: null });
    const record = { ...parent, updatedAt: '2026-10-05T10:00:00.000Z' };
    await createAgendaNextAction(record, intent);
    await createAgendaNextAction(record, intent);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc).toHaveBeenCalledWith('create_agenda_next_action', expect.objectContaining({
      p_parent_id: parent.id, p_request_id: intent.requestId, p_duration_minutes: 30, p_allow_conflict: false,
    }));
  });
  it('não faz fallback não atômico quando RPC falha', async () => {
    const { createAgendaNextAction } = await import('./appointmentsRepository');
    rpc.mockRejectedValue(new Error('network'));
    await expect(createAgendaNextAction(parent, intent)).rejects.toThrow('network');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
