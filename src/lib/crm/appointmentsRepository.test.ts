import { describe, expect, it } from 'vitest';
import { appointmentMappers } from './appointmentsRepository';

const appointment = {
  id: '4b7c4567-e89b-12d3-a456-426614174000', titulo: 'Apresentação comercial', lead: 'Marina Costa',
  leadId: '1b7c4567-e89b-12d3-a456-426614174000', empresa: 'Empresa Exemplo', data: '2026-08-27',
  horaInicio: '10:00', horaFim: '11:00', tipo: 'reuniao' as const, canal: 'video' as const,
  status: 'agendado' as const, responsavel: 'Ana SDR', observacoes: 'Validar escopo comercial.',
  origem: 'ana' as const, lembretesEnviados: ['24h'],
};

describe('appointmentMappers', () => {
  it('preserva os dados operacionais da agenda no contrato remoto', () => {
    const row = appointmentMappers.appointmentToInsertRow(appointment, '9b7c4567-e89b-12d3-a456-426614174000', '8b7c4567-e89b-12d3-a456-426614174000');
    expect(row.status).toBe('scheduled');
    expect(row.metadata).toMatchObject({ tipo: 'reuniao', canal: 'video', origem: 'ana' });
    expect(row.starts_at).toContain('T');
  });

  it('reconstitui o compromisso a partir da tabela appointments', () => {
    const mapped = appointmentMappers.rowToAppointment({
      ...appointmentMappers.appointmentToInsertRow(appointment, '9b7c4567-e89b-12d3-a456-426614174000', '8b7c4567-e89b-12d3-a456-426614174000'),
      created_at: '2026-08-27T10:00:00.000Z', updated_at: '2026-08-27T10:00:00.000Z', meeting_url: null,
    });
    expect(mapped).toMatchObject({ titulo: appointment.titulo, status: 'agendado', origem: 'ana', leadId: appointment.leadId });
  });
});
