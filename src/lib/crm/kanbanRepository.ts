import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { crmRowToLead, type CrmLeadRow } from '@/lib/crm/leadMapper';
import type { CanonicalStageKey } from '@/lib/crm/leadStageRepository';
import type { Lead } from '@/mocks/leadsData';

export type KanbanSort = 'next_action' | 'fit' | 'stage_age' | 'updated' | 'company';
export type KanbanContactFilter = '' | 'with_phone' | 'without_phone' | 'whatsapp' | 'with_email' | 'without_email' | 'without_contact';
export type KanbanNextActionFilter = '' | 'without' | 'overdue';
export type KanbanQuickFilter = '' | 'mine' | 'overdue' | 'without_contact' | 'without_action' | 'high_fit';

export interface KanbanPortfolioFilters {
  query: string;
  ownerId: string;
  segment: string;
  city: string;
  uf: string;
  origin: string;
  listId: string;
  scoreMin: string;
  scoreMax: string;
  contact: KanbanContactFilter;
  nextAction: KanbanNextActionFilter;
  inactiveDays: string;
  stageDays: string;
  enteredFrom: string;
  enteredTo: string;
  contactApproval: '' | 'pending' | 'approved' | 'rejected';
  quick: KanbanQuickFilter;
  duplicatesOnly: boolean;
  showClosed: boolean;
  sort: KanbanSort;
}

export const initialKanbanPortfolioFilters: KanbanPortfolioFilters = {
  query: '', ownerId: '', segment: '', city: '', uf: '', origin: '', listId: '',
  scoreMin: '', scoreMax: '', contact: '', nextAction: '', inactiveDays: '', stageDays: '',
  enteredFrom: '', enteredTo: '', contactApproval: '', quick: '', duplicatesOnly: false,
  showClosed: false, sort: 'next_action',
};

export interface KanbanNextAction {
  text: string | null;
  dueAt: string | null;
  owner: string | null;
  source: 'task' | 'qualification' | 'lead' | null;
}

export interface KanbanPortfolioItem {
  lead: Lead;
  stage: CanonicalStageKey;
  nextAction: KanbanNextAction;
  stageEnteredAt: string | null;
  stageAlertAfterHours: number | null;
  listId: string | null;
  listName: string | null;
  duplicateSuspected: boolean;
}

export interface KanbanPortfolioResult {
  items: KanbanPortfolioItem[];
  total: number;
  stageCounts: Record<CanonicalStageKey, number>;
  quickCounts: Record<Exclude<KanbanQuickFilter, ''>, number>;
}

type PortfolioRpcRow = CrmLeadRow & {
  stage_key?: CanonicalStageKey;
  next_task_id?: string | null;
  next_task_text?: string | null;
  next_task_due_at?: string | null;
  next_task_owner_label?: string | null;
  qualification_next_action?: string | null;
  qualification_next_action_due_at?: string | null;
  effective_next_action_at?: string | null;
  effective_next_action_text?: string | null;
  effective_stage_entered_at?: string | null;
  list_id?: string | null;
  list_name?: string | null;
  duplicate_suspected?: boolean | null;
  stage_alert_after_hours?: number | null;
};

type PortfolioRpcResponse = {
  items?: PortfolioRpcRow[];
  total?: number;
  stage_counts?: Partial<Record<CanonicalStageKey, number>>;
  quick_counts?: Partial<Record<Exclude<KanbanQuickFilter, ''>, number>>;
};

const stages: CanonicalStageKey[] = ['novo', 'apresentado', 'qualificando', 'reuniao', 'orcamento', 'ganho', 'perdido'];

const safeNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
const safeText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;

export function kanbanPortfolioRequestPayload(filters: KanbanPortfolioFilters): Record<string, unknown> {
  return {
    query: filters.query.trim(), owner_id: filters.ownerId || null, segment: filters.segment || null,
    city: filters.city || null, uf: filters.uf || null, origin: filters.origin || null,
    list_id: filters.listId || null, score_min: filters.scoreMin || null, score_max: filters.scoreMax || null,
    contact: filters.contact || null, next_action: filters.nextAction || null,
    inactive_days: filters.inactiveDays || null, stage_days: filters.stageDays || null,
    entered_from: filters.enteredFrom || null, entered_to: filters.enteredTo || null,
    contact_approval: filters.contactApproval || null, quick: filters.quick || null, duplicates: filters.duplicatesOnly,
    show_closed: filters.showClosed, sort: filters.sort,
  };
}

function mapItem(row: PortfolioRpcRow): KanbanPortfolioItem {
  const stage = stages.includes(row.stage_key as CanonicalStageKey) ? row.stage_key as CanonicalStageKey : 'novo';
  const taskText = safeText(row.next_task_text);
  const qualificationText = safeText(row.qualification_next_action);
  const leadText = safeText(row.effective_next_action_text);
  return {
    lead: crmRowToLead(row),
    stage,
    nextAction: {
      text: taskText ?? qualificationText ?? leadText,
      dueAt: safeText(row.effective_next_action_at),
      owner: taskText ? safeText(row.next_task_owner_label) : null,
      source: taskText ? 'task' : qualificationText ? 'qualification' : leadText ? 'lead' : null,
    },
    stageEnteredAt: safeText(row.effective_stage_entered_at),
    stageAlertAfterHours: typeof row.stage_alert_after_hours === 'number' && Number.isFinite(row.stage_alert_after_hours)
      ? Math.max(1, Math.trunc(row.stage_alert_after_hours))
      : null,
    listId: safeText(row.list_id),
    listName: safeText(row.list_name),
    duplicateSuspected: row.duplicate_suspected === true,
  };
}

export function mapKanbanPortfolioResponse(response: PortfolioRpcResponse): KanbanPortfolioResult {
  const stageCounts = stages.reduce((result, stage) => ({ ...result, [stage]: safeNumber(response.stage_counts?.[stage]) }), {} as Record<CanonicalStageKey, number>);
  const quickKeys: Exclude<KanbanQuickFilter, ''>[] = ['mine', 'overdue', 'without_contact', 'without_action', 'high_fit'];
  const quickCounts = quickKeys.reduce((result, key) => ({ ...result, [key]: safeNumber(response.quick_counts?.[key]) }), {} as Record<Exclude<KanbanQuickFilter, ''>, number>);
  return { items: (Array.isArray(response.items) ? response.items : []).map(mapItem), total: safeNumber(response.total), stageCounts, quickCounts };
}

/**
 * Board data comes from a single RLS-bound RPC. The database applies every
 * search/filter before pagination and returns the matching stage counters in
 * the same snapshot, so the columns cannot drift from the current filters.
 */
export async function loadKanbanPortfolio(
  filters: KanbanPortfolioFilters,
  offset = 0,
  limit = 200,
): Promise<KanbanPortfolioResult> {
  await resolveOrganizationSession();
  const { data, error } = await supabase.rpc('get_kanban_portfolio', {
    p_filters: kanbanPortfolioRequestPayload(filters), p_offset: Math.max(0, offset), p_limit: Math.min(200, Math.max(1, limit)),
  });
  if (error) throw error;
  const response = (data && typeof data === 'object' ? data : {}) as PortfolioRpcResponse;
  return mapKanbanPortfolioResponse(response);
}

export interface KanbanSavedView<T> {
  id: string;
  name: string;
  configuration: T;
  isDefault: boolean;
  updatedAt: string;
}

type SavedViewRow<T> = { id: string; name: string; configuration: T; is_default: boolean; updated_at: string };

const mapSavedView = <T,>(row: SavedViewRow<T>): KanbanSavedView<T> => ({
  id: row.id, name: row.name, configuration: row.configuration, isDefault: row.is_default, updatedAt: row.updated_at,
});

export async function loadKanbanSavedViews<T>(): Promise<KanbanSavedView<T>[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('user_saved_views')
    .select('id,name,configuration,is_default,updated_at')
    .eq('organization_id', session.organizationId).eq('user_id', session.userId).eq('module_key', 'kanban')
    .order('is_default', { ascending: false }).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapSavedView(row as SavedViewRow<T>));
}

export async function createKanbanSavedView<T>(name: string, configuration: T): Promise<KanbanSavedView<T>> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('user_saved_views').insert({
    organization_id: session.organizationId, user_id: session.userId, module_key: 'kanban',
    name: name.trim(), configuration, updated_at: new Date().toISOString(),
  }).select('id,name,configuration,is_default,updated_at').single();
  if (error) throw error;
  return mapSavedView(data as SavedViewRow<T>);
}

export async function updateKanbanSavedView<T>(id: string, configuration: T): Promise<void> {
  const { error } = await supabase.from('user_saved_views').update({ configuration, updated_at: new Date().toISOString() }).eq('id', id).eq('module_key', 'kanban');
  if (error) throw error;
}

export async function renameKanbanSavedView(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('user_saved_views').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', id).eq('module_key', 'kanban');
  if (error) throw error;
}

export async function deleteKanbanSavedView(id: string): Promise<void> {
  const { error } = await supabase.from('user_saved_views').delete().eq('id', id).eq('module_key', 'kanban');
  if (error) throw error;
}

export async function setDefaultKanbanSavedView(id: string): Promise<void> {
  const session = await resolveOrganizationSession();
  const { error: clearError } = await supabase.from('user_saved_views').update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('organization_id', session.organizationId).eq('user_id', session.userId).eq('module_key', 'kanban').eq('is_default', true);
  if (clearError) throw clearError;
  const { data, error } = await supabase.from('user_saved_views').update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', session.organizationId).eq('user_id', session.userId).eq('module_key', 'kanban').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('saved_view_not_found_or_forbidden');
}

export interface KanbanStageAlertThreshold {
  id: string;
  stage: CanonicalStageKey;
  alertAfterHours: number;
}

/** The same canonical pipeline used by transitions also owns the board alerts. */
export async function loadKanbanStageAlertThresholds(): Promise<KanbanStageAlertThreshold[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('pipeline_stages')
    .select('id,ana_stage_key,alert_after_hours')
    .eq('organization_id', session.organizationId)
    .eq('active', true);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const stage = row.ana_stage_key as CanonicalStageKey | null;
    if (!stage || !stages.includes(stage) || typeof row.alert_after_hours !== 'number') return [];
    return [{ id: row.id, stage, alertAfterHours: Math.max(1, Math.trunc(row.alert_after_hours)) }];
  });
}

export async function updateKanbanStageAlertThreshold(id: string, alertAfterHours: number): Promise<void> {
  await resolveOrganizationSession();
  const { error } = await supabase.rpc('update_kanban_stage_alert_threshold', {
    p_stage_id: id,
    p_alert_after_hours: Math.round(alertAfterHours),
  });
  if (error) throw error;
}

export interface KanbanAutomationRun {
  id: string;
  event: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
}

/** Read-only operational evidence for the Automations panel. */
export async function loadKanbanAutomationRuns(): Promise<KanbanAutomationRun[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('agent_runs')
    .select('id,event,status,started_at,completed_at,error_code')
    .eq('organization_id', session.organizationId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    event: typeof row.event === 'string' ? row.event : 'Evento não informado',
    status: typeof row.status === 'string' ? row.status : 'indisponível',
    startedAt: typeof row.started_at === 'string' ? row.started_at : null,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    errorCode: typeof row.error_code === 'string' ? row.error_code : null,
  }));
}

export interface KanbanTimelineItem {
  id: string;
  fromStage: string | null;
  toStage: string;
  reason: string | null;
  source: string;
  createdAt: string;
}

export interface KanbanInteractionItem {
  id: string;
  sender: string;
  senderName: string | null;
  type: string;
  text: string;
  createdAt: string;
}

export interface KanbanNoteItem {
  id: string;
  body: string;
  createdAt: string;
}

export async function loadKanbanLeadDetails(leadId: string): Promise<{ timeline: KanbanTimelineItem[]; interactions: KanbanInteractionItem[]; notes: KanbanNoteItem[] }> {
  const [timelineResult, interactionResult, noteResult] = await Promise.all([
    supabase.from('lead_stage_history').select('id,from_stage,to_stage,reason,source,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(40),
    supabase.from('lead_messages').select('id,sender,sender_name,type,text,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20),
    supabase.from('lead_notes').select('id,body,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20),
  ]);
  if (timelineResult.error) throw timelineResult.error;
  if (interactionResult.error) throw interactionResult.error;
  if (noteResult.error) throw noteResult.error;
  return {
    timeline: (timelineResult.data ?? []).map((item) => ({ id: item.id, fromStage: item.from_stage, toStage: item.to_stage, reason: item.reason, source: item.source, createdAt: item.created_at })),
    interactions: (interactionResult.data ?? []).map((item) => ({ id: item.id, sender: item.sender, senderName: item.sender_name, type: item.type, text: item.text, createdAt: item.created_at })),
    notes: (noteResult.data ?? []).map((item) => ({ id: item.id, body: item.body, createdAt: item.created_at })),
  };
}
