import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { isUuid } from '@/lib/crm/leadMapper';
import type { Compromisso } from '@/mocks/frontendAdvancedData';

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
type AppointmentMetadata = Record<string, unknown>;

interface AppointmentRow {
  id: string;
  organization_id: string;
  lead_id: string;
  user_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string | null;
  meeting_url: string | null;
  notes: string | null;
  metadata: AppointmentMetadata;
  created_at: string;
  updated_at: string;
  lead?: { contact?: string | null; company?: string | null } | null;
}

const statusToDatabase: Record<Compromisso['status'], AppointmentStatus> = {
  agendado: 'scheduled', realizado: 'completed', cancelado: 'cancelled', no_show: 'no_show',
};

const statusFromDatabase: Record<string, Compromisso['status']> = {
  scheduled: 'agendado', completed: 'realizado', cancelled: 'cancelado', canceled: 'cancelado', no_show: 'no_show',
};

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function tipoValue(value: unknown): Compromisso['tipo'] {
  return value === 'ligacao' || value === 'followup' || value === 'proposta' ? value : 'reuniao';
}

function canalValue(value: unknown): Compromisso['canal'] {
  return value === 'presencial' || value === 'telefone' || value === 'whatsapp' ? value : 'video';
}

function origemValue(value: unknown): Compromisso['origem'] | undefined {
  return value === 'ana' || value === 'manual' ? value : undefined;
}

function remindersValue(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;
}

function toIsoDateTime(date: string, time: string): string {
  const instant = new Date(`${date}T${time}:00`);
  if (Number.isNaN(instant.getTime())) throw new Error('appointment_datetime_invalid');
  return instant.toISOString();
}

function fromIsoDateTime(value: string): Pick<Compromisso, 'data' | 'horaInicio'> {
  const instant = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return {
    data: `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`,
    horaInicio: `${pad(instant.getHours())}:${pad(instant.getMinutes())}`,
  };
}

function appointmentToMetadata(appointment: Compromisso): AppointmentMetadata {
  return {
    lead: appointment.lead, empresa: appointment.empresa, tipo: appointment.tipo, canal: appointment.canal,
    responsavel: appointment.responsavel, origem: appointment.origem, lembretesEnviados: appointment.lembretesEnviados ?? [],
  };
}

function rowToAppointment(row: AppointmentRow): Compromisso {
  const metadata = row.metadata ?? {};
  const start = fromIsoDateTime(row.starts_at);
  const end = fromIsoDateTime(row.ends_at);
  const origem = origemValue(metadata.origem);
  const lembretesEnviados = remindersValue(metadata.lembretesEnviados);
  return {
    id: row.id,
    titulo: row.title,
    lead: stringValue(metadata.lead, row.lead?.contact ?? 'Lead sem contato'),
    leadId: row.lead_id,
    empresa: stringValue(metadata.empresa, row.lead?.company ?? ''),
    data: start.data,
    horaInicio: start.horaInicio,
    horaFim: end.horaInicio,
    tipo: tipoValue(metadata.tipo),
    canal: canalValue(metadata.canal),
    status: statusFromDatabase[row.status ?? 'scheduled'] ?? 'agendado',
    responsavel: stringValue(metadata.responsavel, 'Você'),
    observacoes: row.notes ?? '',
    ...(origem ? { origem } : {}),
    ...(lembretesEnviados ? { lembretesEnviados } : {}),
  };
}

function appointmentToInsertRow(appointment: Compromisso, organizationId: string, userId: string) {
  if (!appointment.leadId || !isUuid(appointment.leadId)) throw new Error('appointment_lead_id_invalid');
  return {
    id: appointment.id, organization_id: organizationId, lead_id: appointment.leadId, user_id: userId,
    title: appointment.titulo.trim(), starts_at: toIsoDateTime(appointment.data, appointment.horaInicio),
    ends_at: toIsoDateTime(appointment.data, appointment.horaFim), status: statusToDatabase[appointment.status],
    notes: appointment.observacoes.trim() || null, metadata: appointmentToMetadata(appointment),
  };
}

function appointmentToUpdateRow(appointment: Compromisso) {
  return {
    title: appointment.titulo.trim(), starts_at: toIsoDateTime(appointment.data, appointment.horaInicio),
    ends_at: toIsoDateTime(appointment.data, appointment.horaFim), status: statusToDatabase[appointment.status],
    notes: appointment.observacoes.trim() || null, metadata: appointmentToMetadata(appointment),
  };
}

export async function loadOperationalAppointments(): Promise<Compromisso[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('appointments')
    .select('id, organization_id, lead_id, user_id, title, starts_at, ends_at, status, meeting_url, notes, metadata, created_at, updated_at, lead:leads(contact, company)')
    .eq('organization_id', session.organizationId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as AppointmentRow[]).map(rowToAppointment);
}

export async function createOperationalAppointment(appointment: Compromisso): Promise<Compromisso> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('appointments')
    .insert(appointmentToInsertRow(appointment, session.organizationId, session.userId))
    .select('id, organization_id, lead_id, user_id, title, starts_at, ends_at, status, meeting_url, notes, metadata, created_at, updated_at')
    .single();
  if (error) throw error;
  return rowToAppointment(data as AppointmentRow);
}

export async function updateOperationalAppointment(appointment: Compromisso): Promise<Compromisso> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('appointments')
    .update(appointmentToUpdateRow(appointment))
    .eq('id', appointment.id)
    .eq('organization_id', session.organizationId)
    .select('id, organization_id, lead_id, user_id, title, starts_at, ends_at, status, meeting_url, notes, metadata, created_at, updated_at')
    .single();
  if (error) throw error;
  return rowToAppointment(data as AppointmentRow);
}

export async function deleteOperationalAppointment(id: string): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error } = await supabase.from('appointments').delete().eq('id', id).eq('organization_id', session.organizationId);
  if (error) throw error;
}

export const appointmentMappers = { rowToAppointment, appointmentToInsertRow, appointmentToUpdateRow };
