import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { isUuid } from '@/lib/crm/leadMapper';

export const agendaTypes = ['reuniao', 'ligacao', 'followup', 'tarefa', 'outro'] as const;
export const agendaStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export const agendaOrigins = ['manual', 'ana', 'integration'] as const;

export type AgendaType = typeof agendaTypes[number];
export type AgendaStatus = typeof agendaStatuses[number];
export type AgendaOrigin = typeof agendaOrigins[number];
export type AgendaViewKind = 'day' | 'week' | 'month' | 'list';

export interface AgendaAppointment {
  id: string;
  leadId: string;
  leadName: string;
  company: string;
  phone: string | null;
  email: string | null;
  segment: string | null;
  stage: string | null;
  title: string;
  description: string;
  notes: string;
  type: AgendaType;
  status: AgendaStatus;
  confirmationStatus: 'pending' | 'confirmed';
  startsAt: string;
  endsAt: string;
  timezone: string;
  responsibleId: string | null;
  responsibleName: string;
  participants: string[];
  location: string;
  reminderMinutes: number[];
  reminderStatus: 'not_scheduled' | 'pending' | 'sent' | 'failed';
  origin: AgendaOrigin;
  originConversationId: string | null;
  originMessageId: string | null;
  provider: string | null;
  externalId: string | null;
  result: string;
  cancelReason: string;
  noShowReason: string;
  nextActionAt: string | null;
  nextActionTitle: string | null;
  updatedAt: string;
  createdAt: string;
  isOverdue: boolean;
}

export interface AgendaFilters {
  query: string;
  responsibleId: string;
  type: '' | AgendaType;
  status: '' | AgendaStatus;
  origin: '' | AgendaOrigin;
  segment: string;
  confirmation: '' | 'pending' | 'confirmed';
  nextAction: '' | 'with' | 'without';
  quick: '' | 'mine' | 'ana' | 'overdue';
  rangeStart: string;
  rangeEnd: string;
}

export interface AgendaPortfolio { items: AgendaAppointment[]; total: number; }
export interface AgendaSavedView<T = Record<string, unknown>> { id: string; name: string; configuration: T; isDefault: boolean; updatedAt: string; }
export interface AgendaHistoryEntry { id: string; action: string; detail: string | null; occurredAt: string; actorName: string; }

type JsonRecord = Record<string, unknown>;
interface PortfolioRow {
  id: string; lead_id: string; title: string; starts_at: string; ends_at: string; status: string | null;
  notes: string | null; meeting_url: string | null; provider: string | null; external_id: string | null;
  metadata: JsonRecord | null; created_at: string; updated_at: string; lead_contact: string | null;
  lead_company: string | null; lead_phone: string | null; lead_email: string | null; lead_segment: string | null;
  lead_stage: string | null; responsible_id: string | null; responsible_name: string | null;
  appointment_type: string | null; appointment_origin: string | null; confirmation_status: string | null;
  next_action_at: string | null; timezone: string | null; is_overdue: boolean | null;
}
interface PortfolioResponse { total?: unknown; items?: unknown; }
type SavedViewRow<T> = { id: string; name: string; configuration: T; is_default: boolean; updated_at: string; };

const stringValue = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 20) : [];
const numberList = (value: unknown): number[] => Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 43200).slice(0, 4) : [];

export function validAgendaTimezone(value: unknown): string {
  const timezone = typeof value === 'string' ? value : '';
  try { Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return timezone; }
  catch { return 'America/Sao_Paulo'; }
}

function agendaType(value: unknown): AgendaType {
  if (value === 'reuniao' || value === 'ligacao' || value === 'followup' || value === 'tarefa' || value === 'outro') return value;
  return value === 'proposta' ? 'outro' : 'reuniao';
}
function agendaStatus(value: unknown): AgendaStatus {
  if (value === 'confirmed' || value === 'completed' || value === 'cancelled' || value === 'no_show') return value;
  return 'pending';
}
function agendaOrigin(value: unknown): AgendaOrigin { return value === 'ana' || value === 'integration' ? value : 'manual'; }

function mapRow(row: PortfolioRow): AgendaAppointment {
  const metadata = row.metadata ?? {};
  const status = agendaStatus(row.status);
  const confirmationStatus = row.confirmation_status === 'confirmed' || status === 'confirmed' ? 'confirmed' : 'pending';
  return {
    id: row.id, leadId: row.lead_id, leadName: stringValue(metadata.lead, row.lead_contact ?? 'Lead sem contato'),
    company: stringValue(metadata.empresa, row.lead_company ?? ''), phone: (row.lead_phone ?? stringValue(metadata.contact_phone)) || null,
    email: (row.lead_email ?? stringValue(metadata.contact_email)) || null, segment: row.lead_segment, stage: row.lead_stage,
    title: row.title, description: stringValue(metadata.description), notes: row.notes ?? '',
    type: agendaType(row.appointment_type ?? metadata.type ?? metadata.tipo), status, confirmationStatus,
    startsAt: row.starts_at, endsAt: row.ends_at, timezone: validAgendaTimezone(row.timezone ?? metadata.timezone),
    responsibleId: (row.responsible_id ?? stringValue(metadata.responsible_user_id)) || null,
    responsibleName: row.responsible_name ?? stringValue(metadata.responsible_name, stringValue(metadata.responsavel, 'Sem responsável')),
    participants: stringList(metadata.participants), location: stringValue(metadata.location, row.meeting_url ?? ''),
    reminderMinutes: numberList(metadata.reminder_minutes),
    reminderStatus: metadata.reminder_status === 'pending' || metadata.reminder_status === 'sent' || metadata.reminder_status === 'failed' ? metadata.reminder_status : 'not_scheduled',
    origin: agendaOrigin(row.appointment_origin ?? metadata.origin), originConversationId: stringValue(metadata.origin_conversation_id) || null,
    originMessageId: stringValue(metadata.origin_message_id) || null, provider: row.provider, externalId: row.external_id,
    result: stringValue(metadata.result), cancelReason: stringValue(metadata.cancel_reason), noShowReason: stringValue(metadata.no_show_reason),
    nextActionAt: (row.next_action_at ?? stringValue(metadata.next_action_at)) || null, nextActionTitle: stringValue(metadata.next_action_title) || null,
    updatedAt: row.updated_at, createdAt: row.created_at, isOverdue: row.is_overdue === true,
  };
}

function toMetadata(appointment: AgendaAppointment): JsonRecord {
  return {
    lead: appointment.leadName, empresa: appointment.company, type: appointment.type, responsible_user_id: appointment.responsibleId,
    responsible_name: appointment.responsibleName, origin: appointment.origin, confirmation_status: appointment.confirmationStatus,
    timezone: validAgendaTimezone(appointment.timezone), participants: appointment.participants, location: appointment.location,
    description: appointment.description, reminder_minutes: appointment.reminderMinutes, reminder_status: appointment.reminderStatus,
    origin_conversation_id: appointment.originConversationId, origin_message_id: appointment.originMessageId, result: appointment.result,
    cancel_reason: appointment.cancelReason, no_show_reason: appointment.noShowReason, next_action_at: appointment.nextActionAt,
    next_action_title: appointment.nextActionTitle,
  };
}

function editableRow(appointment: AgendaAppointment) {
  if (!appointment.leadId || !isUuid(appointment.leadId)) throw new Error('appointment_lead_id_invalid');
  const startsAt = new Date(appointment.startsAt); const endsAt = new Date(appointment.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new Error('appointment_datetime_invalid');
  return { lead_id: appointment.leadId, title: appointment.title.trim().slice(0, 240) || 'Compromisso comercial', starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(), status: appointment.status, meeting_url: appointment.location.trim() || null,
    notes: appointment.notes.trim() || null, metadata: toMetadata(appointment) };
}

function asPortfolioRow(value: unknown): PortfolioRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<PortfolioRow>;
  if (typeof row.id !== 'string' || typeof row.lead_id !== 'string' || typeof row.title !== 'string' || typeof row.starts_at !== 'string'
    || typeof row.ends_at !== 'string' || typeof row.updated_at !== 'string' || typeof row.created_at !== 'string') return null;
  return row as PortfolioRow;
}

export async function loadAgendaPortfolio(filters: AgendaFilters, offset = 0, limit = 100): Promise<AgendaPortfolio> {
  await resolveOrganizationSession();
  const { data, error } = await supabase.rpc('get_agenda_portfolio', {
    p_filters: { query: filters.query, responsible_id: filters.responsibleId, type: filters.type, status: filters.status,
      origin: filters.origin, segment: filters.segment, confirmation: filters.confirmation, next_action: filters.nextAction,
      quick: filters.quick, range_start: filters.rangeStart, range_end: filters.rangeEnd },
    p_offset: Math.max(0, offset), p_limit: Math.min(200, Math.max(1, limit)),
  });
  if (error) throw error;
  const response = (data && typeof data === 'object' ? data : {}) as PortfolioResponse;
  const items = Array.isArray(response.items) ? response.items.map(asPortfolioRow).filter((row): row is PortfolioRow => row !== null).map(mapRow) : [];
  return { items, total: typeof response.total === 'number' ? response.total : items.length };
}

function createMapperRow(data: unknown, input: AgendaAppointment): PortfolioRow {
  return { ...(data as Omit<PortfolioRow, 'lead_contact' | 'lead_company' | 'lead_phone' | 'lead_email' | 'lead_segment' | 'lead_stage' | 'responsible_id' | 'responsible_name' | 'appointment_type' | 'appointment_origin' | 'confirmation_status' | 'next_action_at' | 'timezone' | 'is_overdue'>),
    lead_contact: input.leadName, lead_company: input.company, lead_phone: input.phone, lead_email: input.email, lead_segment: input.segment, lead_stage: input.stage,
    responsible_id: input.responsibleId, responsible_name: input.responsibleName, appointment_type: input.type, appointment_origin: input.origin,
    confirmation_status: input.confirmationStatus, next_action_at: input.nextActionAt, timezone: input.timezone, is_overdue: false };
}

export async function createOperationalAppointment(input: AgendaAppointment): Promise<AgendaAppointment> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('appointments').insert({ id: input.id, organization_id: session.organizationId, user_id: session.userId, ...editableRow(input) })
    .select('id,lead_id,title,starts_at,ends_at,status,notes,meeting_url,provider,external_id,metadata,created_at,updated_at').single();
  if (error) throw error;
  return mapRow(createMapperRow(data, input));
}

export async function updateOperationalAppointment(input: AgendaAppointment, expectedUpdatedAt: string): Promise<AgendaAppointment> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('appointments').update(editableRow(input)).eq('id', input.id)
    .eq('organization_id', session.organizationId).eq('updated_at', expectedUpdatedAt)
    .select('id,lead_id,title,starts_at,ends_at,status,notes,meeting_url,provider,external_id,metadata,created_at,updated_at').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('appointment_concurrent_update');
  return mapRow(createMapperRow(data, input));
}

export async function findAgendaConflicts(input: Pick<AgendaAppointment, 'startsAt' | 'endsAt' | 'responsibleId' | 'responsibleName'>, ignoreId?: string): Promise<AgendaAppointment[]> {
  // Conflito é da agenda de uma pessoa. Sem responsável definido, não há uma
  // carteira individual a bloquear e o usuário deve escolher o responsável.
  if (!input.responsibleId) return [];
  const session = await resolveOrganizationSession();
  let query = supabase.from('appointments').select('id,lead_id,title,starts_at,ends_at,status,notes,meeting_url,provider,external_id,metadata,created_at,updated_at,lead:leads(contact,company,phone,email,segment,stage)')
    .eq('organization_id', session.organizationId).lt('starts_at', input.endsAt).gt('ends_at', input.startsAt).in('status', ['scheduled', 'confirmed', 'pending']);
  query = query.eq('metadata->>responsible_user_id', input.responsibleId);
  if (ignoreId) query = query.neq('id', ignoreId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const item = row as Record<string, unknown>; const lead = (item.lead && typeof item.lead === 'object' ? item.lead : {}) as Record<string, unknown>;
    const metadata = (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as JsonRecord;
    return mapRow({ ...(item as unknown as PortfolioRow), lead_contact: stringValue(lead.contact), lead_company: stringValue(lead.company), lead_phone: stringValue(lead.phone) || null,
      lead_email: stringValue(lead.email) || null, lead_segment: stringValue(lead.segment) || null, lead_stage: stringValue(lead.stage) || null,
      responsible_id: stringValue(metadata.responsible_user_id) || null, responsible_name: stringValue(metadata.responsible_name, input.responsibleName),
      appointment_type: stringValue(metadata.type), appointment_origin: stringValue(metadata.origin), confirmation_status: stringValue(metadata.confirmation_status),
      next_action_at: stringValue(metadata.next_action_at) || null, timezone: stringValue(metadata.timezone, 'America/Sao_Paulo'), is_overdue: false });
  });
}

export async function loadAgendaHistory(appointmentId: string): Promise<AgendaHistoryEntry[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('audit_logs').select('id,action,detail,occurred_at,actor_name').eq('organization_id', session.organizationId)
    .eq('entity_id', appointmentId).eq('entity_table', 'appointments').order('occurred_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), action: stringValue(row.action), detail: typeof row.detail === 'string' ? row.detail : null,
    occurredAt: stringValue(row.occurred_at), actorName: stringValue(row.actor_name, 'Sistema') }));
}

const mapSavedView = <T,>(row: SavedViewRow<T>): AgendaSavedView<T> => ({ id: row.id, name: row.name, configuration: row.configuration, isDefault: row.is_default, updatedAt: row.updated_at });

export async function loadAgendaSavedViews<T>(): Promise<AgendaSavedView<T>[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('user_saved_views').select('id,name,configuration,is_default,updated_at')
    .eq('organization_id', session.organizationId).eq('user_id', session.userId).eq('module_key', 'agenda').order('is_default', { ascending: false }).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapSavedView(row as SavedViewRow<T>));
}
export async function createAgendaSavedView<T>(name: string, configuration: T): Promise<AgendaSavedView<T>> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('user_saved_views').insert({ organization_id: session.organizationId, user_id: session.userId, module_key: 'agenda', name: name.trim(), configuration, updated_at: new Date().toISOString() }).select('id,name,configuration,is_default,updated_at').single();
  if (error) throw error;
  return mapSavedView(data as SavedViewRow<T>);
}
export async function updateAgendaSavedView<T>(id: string, configuration: T): Promise<void> {
  const { error } = await supabase.from('user_saved_views').update({ configuration, updated_at: new Date().toISOString() }).eq('id', id).eq('module_key', 'agenda'); if (error) throw error;
}
export async function renameAgendaSavedView(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('user_saved_views').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', id).eq('module_key', 'agenda'); if (error) throw error;
}
export async function deleteAgendaSavedView(id: string): Promise<void> {
  const { error } = await supabase.from('user_saved_views').delete().eq('id', id).eq('module_key', 'agenda'); if (error) throw error;
}
export async function setDefaultAgendaSavedView(id: string): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error: clearError } = await supabase.from('user_saved_views').update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('organization_id', session.organizationId).eq('user_id', session.userId).eq('module_key', 'agenda').eq('is_default', true);
  if (clearError) throw clearError;
  const { data, error } = await supabase.from('user_saved_views').update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', session.organizationId).eq('user_id', session.userId).eq('module_key', 'agenda').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('agenda_saved_view_not_found_or_forbidden');
}

export const agendaMappers = { mapRow, toMetadata, editableRow, agendaType, agendaStatus, validAgendaTimezone };
