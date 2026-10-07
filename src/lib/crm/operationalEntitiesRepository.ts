import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession, assertOrganizationSession } from '@/lib/organizationSession';
import { isUuid } from '@/lib/crm/leadMapper';
import type { ListaDeLeads, StatusLista } from '@/hooks/useListasStore';
import type { ProdutoCatalogo } from '@/hooks/useCatalogoStore';
import type { FluxoAutomatizacao } from '@/hooks/useFluxosAutomatizacaoStore';

type JsonRecord = Record<string, unknown>;

interface ListRow {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'archived';
  criteria: JsonRecord;
  created_at: string;
}

interface SequenceRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  trigger_key: string;
}

interface SequenceStepRow {
  id: string;
  sequence_id: string;
  channel: string;
  content: string | null;
  delay_minutes: number;
  order_index: number;
}

interface CatalogRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  short_description: string;
  description: string | null;
  active: boolean;
  quote_enabled: boolean;
  max_discount: number | null;
  default_lead_time_days: number;
  price: number | null;
}

const listStatusToDb: Record<StatusLista, ListRow['status']> = {
  pendente: 'pending',
  ativada: 'active',
  arquivada: 'archived',
};

const listStatusFromDb: Record<ListRow['status'], StatusLista> = {
  pending: 'pendente',
  active: 'ativada',
  archived: 'arquivada',
};

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function listToRow(list: ListaDeLeads, organizationId: string, userId: string) {
  return {
    id: list.id,
    organization_id: organizationId,
    name: list.nome.trim(),
    status: listStatusToDb[list.status],
    criteria: {
      segmento: list.segmento,
      cidade: list.cidade,
      estado: list.estado,
      total: list.total,
      fonte: list.fonte,
    },
    created_by: userId,
  };
}

function rowToList(row: ListRow, leadIds: string[]): ListaDeLeads {
  return {
    id: row.id,
    nome: row.name,
    criadaEm: row.created_at,
    segmento: stringValue(row.criteria.segmento),
    cidade: stringValue(row.criteria.cidade),
    estado: stringValue(row.criteria.estado),
    total: leadIds.length,
    fonte: stringValue(row.criteria.fonte, 'Busca manual'),
    leadIds,
    status: listStatusFromDb[row.status],
  };
}

function flowToRow(flow: FluxoAutomatizacao, organizationId: string) {
  return {
    id: flow.id,
    organization_id: organizationId,
    name: flow.nome.trim(),
    description: flow.descricao,
    active: flow.ativo,
    trigger_key: flow.gatilho,
  };
}

function rowToFlow(row: SequenceRow, steps: SequenceStepRow[]): FluxoAutomatizacao {
  return {
    id: row.id,
    nome: row.name,
    gatilho: row.trigger_key || 'novo_lead',
    descricao: row.description ?? '',
    passos: steps
      .sort((a, b) => a.order_index - b.order_index)
      .map((step) => ({
        id: step.id,
        diasApos: Math.max(0, Math.floor(step.delay_minutes / 1440)),
        canal: step.channel === 'email' ? 'E-mail' : 'WhatsApp',
        mensagem: step.content ?? '',
      })),
    ativo: row.active,
  };
}

function catalogToRow(item: ProdutoCatalogo, organizationId: string) {
  return {
    id: item.id,
    organization_id: organizationId,
    code: item.codigo.trim(),
    name: item.nome.trim(),
    category: item.categoria.trim(),
    unit: item.unidade.trim(),
    short_description: item.descricaoCurta.trim(),
    description: item.descricaoCompleta.trim(),
    active: item.ativo,
    quote_enabled: item.podeOrcamento,
    max_discount: Math.min(100, Math.max(0, item.descontoMaximo)),
    default_lead_time_days: Math.max(0, Math.round(item.prazoPadrao)),
    price: Math.max(0, item.precoBase),
  };
}

function rowToCatalog(row: CatalogRow): ProdutoCatalogo {
  return {
    id: row.id,
    nome: row.name,
    codigo: row.code,
    categoria: row.category,
    descricaoCurta: row.short_description,
    descricaoCompleta: row.description ?? '',
    unidade: row.unit,
    ativo: row.active,
    podeOrcamento: row.quote_enabled,
    descontoMaximo: Number(row.max_discount ?? 0),
    prazoPadrao: row.default_lead_time_days,
    precoBase: Number(row.price ?? 0),
  };
}

export async function loadOperationalLists(): Promise<ListaDeLeads[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const { data: lists, error: listsError } = await supabase
    .from('lead_lists')
    .select('id, name, status, criteria, created_at')
    .eq('organization_id', session.organizationId)
    .order('created_at', { ascending: false });
  if (listsError) throw listsError;
  const listIds = (lists ?? []).map((list) => list.id);
  if (listIds.length === 0) return [];
  assertOrganizationSession(session);
  const { data: members, error: membersError } = await supabase
    .from('lead_list_members')
    .select('list_id, lead_id')
    .eq('organization_id', session.organizationId)
    .in('list_id', listIds);
  if (membersError) throw membersError;
  const membersByList = new Map<string, string[]>();
  for (const member of members ?? []) {
    const current = membersByList.get(member.list_id) ?? [];
    current.push(member.lead_id);
    membersByList.set(member.list_id, current);
  }
  return (lists as ListRow[]).map((list) => rowToList(list, membersByList.get(list.id) ?? []));
}

export async function persistOperationalLists(previous: ListaDeLeads[], next: ListaDeLeads[]): Promise<ListaDeLeads[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const previousById = new Map(previous.map((list) => [list.id, list]));
  for (const list of next) {
    assertOrganizationSession(session);
    const row = listToRow(list, session.organizationId, session.userId);
    const { created_by: _createdBy, ...updateRow } = row;
    const { error } = previousById.has(list.id)
      ? await supabase.from('lead_lists').update(updateRow).eq('id', list.id).eq('organization_id', session.organizationId)
      : await supabase.from('lead_lists').insert(row);
    if (error) throw error;

    const before = new Set((previousById.get(list.id)?.leadIds ?? []).filter(isUuid));
    const after = new Set(list.leadIds.filter(isUuid));
    const toAdd = [...after].filter((leadId) => !before.has(leadId));
    const toRemove = [...before].filter((leadId) => !after.has(leadId));
    if (toAdd.length) {
      assertOrganizationSession(session);
      const { error: membersError } = await supabase.from('lead_list_members').upsert(
        toAdd.map((lead_id) => ({ organization_id: session.organizationId, list_id: list.id, lead_id })),
        { onConflict: 'list_id,lead_id' },
      );
      if (membersError) throw membersError;
    }
    if (toRemove.length) {
      assertOrganizationSession(session);
      const { error: removeError } = await supabase
        .from('lead_list_members')
        .delete()
        .eq('organization_id', session.organizationId)
        .eq('list_id', list.id)
        .in('lead_id', toRemove);
      if (removeError) throw removeError;
    }
  }
  return next;
}

export async function loadOperationalFlows(): Promise<FluxoAutomatizacao[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const { data: sequences, error } = await supabase
    .from('outreach_sequences')
    .select('id, name, description, active, trigger_key')
    .eq('organization_id', session.organizationId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const sequenceIds = (sequences ?? []).map((sequence) => sequence.id);
  if (!sequenceIds.length) return [];
  assertOrganizationSession(session);
  const { data: steps, error: stepsError } = await supabase
    .from('outreach_sequence_steps')
    .select('id, sequence_id, channel, content, delay_minutes, order_index')
    .eq('organization_id', session.organizationId)
    .in('sequence_id', sequenceIds);
  if (stepsError) throw stepsError;
  return ((sequences ?? []) as SequenceRow[]).map((sequence) => rowToFlow(
    sequence,
    ((steps ?? []) as SequenceStepRow[]).filter((step) => step.sequence_id === sequence.id),
  ));
}

export async function persistOperationalFlows(previous: FluxoAutomatizacao[], next: FluxoAutomatizacao[]): Promise<FluxoAutomatizacao[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const previousIds = new Set(previous.map((flow) => flow.id));
  for (const flow of next) {
    const row = flowToRow(flow, session.organizationId);
    assertOrganizationSession(session);
    const { error } = previousIds.has(flow.id)
      ? await supabase.from('outreach_sequences').update(row).eq('id', flow.id).eq('organization_id', session.organizationId)
      : await supabase.from('outreach_sequences').insert(row);
    if (error) throw error;

    assertOrganizationSession(session);

    const { error: deleteStepsError } = await supabase
      .from('outreach_sequence_steps')
      .delete()
      .eq('organization_id', session.organizationId)
      .eq('sequence_id', flow.id);
    if (deleteStepsError) throw deleteStepsError;
    if (flow.passos.length) {
      assertOrganizationSession(session);
      const { error: stepsError } = await supabase.from('outreach_sequence_steps').insert(
        flow.passos.map((step, index) => ({
          id: isUuid(step.id) ? step.id : crypto.randomUUID(),
          organization_id: session.organizationId,
          sequence_id: flow.id,
          type: 'message',
          channel: step.canal.toLowerCase() === 'e-mail' ? 'email' : 'whatsapp',
          content: step.mensagem,
          wait_hours: Math.max(0, Math.round(step.diasApos * 24)),
          delay_minutes: Math.max(0, Math.round(step.diasApos * 1440)),
          order_index: index,
        })),
      );
      if (stepsError) throw stepsError;
    }
  }
  const archivedIds = previous.filter((flow) => !next.some((candidate) => candidate.id === flow.id)).map((flow) => flow.id);
  if (archivedIds.length) {
    assertOrganizationSession(session);
    const { error } = await supabase
      .from('outreach_sequences')
      .update({ active: false })
      .eq('organization_id', session.organizationId)
      .in('id', archivedIds);
    if (error) throw error;
  }
  return next;
}

export async function loadOperationalCatalog(): Promise<ProdutoCatalogo[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const { data, error } = await supabase
    .from('services')
    .select('id, code, name, category, unit, short_description, description, active, quote_enabled, max_discount, default_lead_time_days, price')
    .eq('organization_id', session.organizationId)
    .eq('active', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CatalogRow[]).map(rowToCatalog);
}

export async function persistOperationalCatalog(previous: ProdutoCatalogo[], next: ProdutoCatalogo[]): Promise<ProdutoCatalogo[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const previousIds = new Set(previous.map((item) => item.id));
  for (const item of next) {
    const row = catalogToRow(item, session.organizationId);
    assertOrganizationSession(session);
    const { error } = previousIds.has(item.id)
      ? await supabase.from('services').update(row).eq('id', item.id).eq('organization_id', session.organizationId)
      : await supabase.from('services').insert(row);
    if (error) throw error;
  }
  const archivedIds = previous.filter((item) => !next.some((candidate) => candidate.id === item.id)).map((item) => item.id);
  if (archivedIds.length) {
    assertOrganizationSession(session);
    const { error } = await supabase
      .from('services')
      .update({ active: false })
      .eq('organization_id', session.organizationId)
      .in('id', archivedIds);
    if (error) throw error;
  }
  return next;
}

export const operationalEntityMappers = { rowToList, rowToFlow, rowToCatalog };
