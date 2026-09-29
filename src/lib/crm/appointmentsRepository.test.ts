import { describe, expect, it } from 'vitest';
import { agendaMappers, validAgendaTimezone } from './appointmentsRepository';

const row = {
  id: '4b7c4567-e89b-12d3-a456-426614174000', lead_id: '1b7c4567-e89b-12d3-a456-426614174000',
  title: 'Apresentação comercial', starts_at: '2026-09-28T13:00:00.000Z', ends_at: '2026-09-28T14:00:00.000Z',
  status: 'confirmed', notes: 'Validar escopo comercial.', meeting_url: null, provider: null, external_id: null,
  metadata: { lead: 'Marina Costa', empresa: 'Empresa Exemplo', type: 'reuniao', responsible_user_id: '8b7c4567-e89b-12d3-a456-426614174000',
    responsible_name: 'Ana SDR', origin: 'ana', confirmation_status: 'confirmed', timezone: 'America/Sao_Paulo',
    participants: ['marina@exemplo.com'], reminder_minutes: [1440, 60], next_action_at: '2026-09-30T13:00:00.000Z' },
  created_at: '2026-08-27T10:00:00.000Z', updated_at: '2026-08-27T10:00:00.000Z', lead_contact: 'Marina Costa',
  lead_company: 'Empresa Exemplo', lead_phone: '11999999999', lead_email: 'marina@exemplo.com', lead_segment: 'Indústria',
  lead_stage: 'reuniao', responsible_id: '8b7c4567-e89b-12d3-a456-426614174000', responsible_name: 'Ana SDR',
  appointment_type: 'reuniao', appointment_origin: 'ana', confirmation_status: 'confirmed', next_action_at: '2026-09-30T13:00:00.000Z',
  timezone: 'America/Sao_Paulo', is_overdue: false,
};

describe('agendaMappers', () => {
  it('reconstitui a agenda a partir do contrato server-side com fuso e origem', () => {
    const appointment = agendaMappers.mapRow(row);
    expect(appointment).toMatchObject({ leadName: 'Marina Costa', type: 'reuniao', status: 'confirmed', origin: 'ana',
      confirmationStatus: 'confirmed', timezone: 'America/Sao_Paulo', reminderMinutes: [1440, 60] });
  });

  it('preserva os metadados operacionais e não infere entrega de lembrete', () => {
    const appointment = agendaMappers.mapRow(row);
    const metadata = agendaMappers.toMetadata(appointment);
    expect(metadata).toMatchObject({ type: 'reuniao', origin: 'ana', reminder_minutes: [1440, 60], reminder_status: 'not_scheduled' });
  });

  it('normaliza tipos legados e um fuso inválido sem depender do dispositivo', () => {
    expect(agendaMappers.agendaType('proposta')).toBe('outro');
    expect(validAgendaTimezone('America/Sao_Paulo')).toBe('America/Sao_Paulo');
    expect(validAgendaTimezone('fuso-invalido')).toBe('America/Sao_Paulo');
  });
});
