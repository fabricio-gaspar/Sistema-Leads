import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { isUuid } from '@/lib/crm/leadMapper';
import type { ListaDeLeads, StatusLista } from '@/hooks/useListasStore';
import type { ProdutoCatalogo } from '@/hooks/useCatalogoStore';
import type { FluxoAutomatizacao, PassoFluxo } from '@/hooks/useFluxosAutomatizacaoStore';

type JsonRecord = Record<string, unknown>;

interface ListRow {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'archived';
  criteria: JsonRecord;
  created_at: string;
}

interface CampaignRow {
  id: string;
  name: string;
  status: 'draft' | 'pilot' | 'active' | 'paused' | 'archived';
  channel: 'whatsapp' | 'email' | 'mixed';
  cadence: unknown;
  metadata: JsonRecord;
}

interface CatalogRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  short_description: string;
  full_description: string;
  is_active: boolean;
  quote_enabled: boolean;
  maximum_discount: number;
  default_lead_time_days: number;
  base_unit_price: number;
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
    total: numberValue(row.criteria.total, leadIds.length),
    fonte: stringValue(row.criteria.fonte, 'Busca manual'),
    leadIds,
    status: listStatusFromDb[row.status],
  };
}

function validSteps(value: unknown): PassoFluxo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step): PassoFluxo[] => {
    if (!step || typeof step !== 'object') return [];
    const candidate = step as JsonRecord;
    const diasApos = numberValue(candidate.diasApos, 0);
    const canal = stringValue(candidate.canal);
    const mensagem = stringValue(candidate.mensagem);
    if (!canal || !mensagem) return [];
    return [{
      id: stringValue(candidate.id, crypto.randomUUID()),
      diasApos: Math.max(0, Math.floor(diasApos)),
      canal,
      mensagem,
    }];
  });
}

function campaignChannel(passos: PassoFluxo[]): CampaignRow['channel'] {
  const channels = new Set(passos.map((passo) => passo.canal.toLowerCase()));
  if (channels.size === 1 && channels.has('whatsapp')) return 'whatsapp';
  if (channels.size === 1 && channels.has('e-mail')) return 'email';
  return 'mixed';
}

function flowToRow(flow: FluxoAutomatizacao, organizationId: string, userId: string) {
  return {
    id: flow.id,
    organization_id: organizationId,
    name: flow.nome.trim(),
    status: flow.ativo ? 'active' : 'draft',
    channel: campaignChannel(flow.passos),
    cadence: flow.passos,
    metadata: { gatilho: flow.gatilho, descricao: flow.descricao },
    created_by: userId,
  };
}

function rowToFlow(row: CampaignRow): FluxoAutomatizacao {
  return {
    id: row.id,
    nome: row.name,
    gatilho: stringValue(row.metadata.gatilho, 'novo_lead'),
    descricao: stringValue(row.metadata.descricao),
    passos: validSteps(row.cadence),
    ativo: row.status === 'active',
  };
}

function catalogToRow(item: ProdutoCatalogo, organizationId: string, userId: string) {
  return {
    id: item.id,
    organization_id: organizationId,
    code: item.codigo.trim(),
    name: item.nome.trim(),
    category: item.categoria.trim(),
    unit: item.unidade.trim(),
    short_description: item.descricaoCurta.trim(),
    full_description: item.descricaoCompleta.trim(),
    is_active: item.ativo,
    quote_enabled: item.podeOrcamento,
    maximum_discount: Math.min(100, Math.max(0, item.descontoMaximo)),
    default_lead_time_days: Math.max(0, Math.round(item.prazoPadrao)),
    base_unit_price: Math.max(0, item.precoBase),
    created_by: userId,
  };
}

function rowToCatalog(row: CatalogRow): ProdutoCatalogo {
  return {
    id: row.id,
    nome: row.name,
    codigo: row.code,
    categoria: row.category,
    descricaoCurta: row.short_description,
    descricaoCompleta: row.full_description,
    unidade: row.unit,
    ativo: row.is_active,
    podeOrcamento: row.quote_enabled,
    descontoMaximo: Number(row.maximum_discount),
    prazoPadrao: row.default_lead_time_days,
    precoBase: Number(row.base_unit_price),
  };
}

export async function loadOperationalLists(): Promise<ListaDeLeads[]> {
  const session = await resolveOrganizationSession();
  const { data: lists, error: listsError } = await supabase
    .from('crm_lead_lists')
    .select('id, name, status, criteria, created_at')
    .eq('organization_id', session.organizationId)
    .order('created_at', { ascending: false });
  if (listsError) throw listsError;
  const listIds = (lists ?? []).map((list) => list.id);
  if (listIds.length === 0) return [];
  const { data: members, error: membersError } = await supabase
    .from('crm_lead_list_members')
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
  const previousById = new Map(previous.map((list) => [list.id, list]));
  for (const list of next) {
    const row = listToRow(list, session.organizationId, session.userId);
    const { created_by: _createdBy, ...updateRow } = row;
    const { error } = previousById.has(list.id)
      ? await supabase.from('crm_lead_lists').update(updateRow).eq('id', list.id).eq('organization_id', session.organizationId)
      : await supabase.from('crm_lead_lists').insert(row);
    if (error) throw error;

    const before = new Set((previousById.get(list.id)?.leadIds ?? []).filter(isUuid));
    const after = new Set(list.leadIds.filter(isUuid));
    const toAdd = [...after].filter((leadId) => !before.has(leadId));
    const toRemove = [...before].filter((leadId) => !after.has(leadId));
    if (toAdd.length) {
      const { error: membersError } = await supabase.from('crm_lead_list_members').upsert(
        toAdd.map((lead_id) => ({ organization_id: session.organizationId, list_id: list.id, lead_id })),
        { onConflict: 'list_id,lead_id' },
      );
      if (membersError) throw membersError;
    }
    if (toRemove.length) {
      const { error: removeError } = await supabase
        .from('crm_lead_list_members')
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
  const { data, error } = await supabase
    .from('crm_campaigns')
    .select('id, name, status, channel, cadence, metadata')
    .eq('organization_id', session.organizationId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CampaignRow[]).map(rowToFlow);
}

export async function persistOperationalFlows(previous: FluxoAutomatizacao[], next: FluxoAutomatizacao[]): Promise<FluxoAutomatizacao[]> {
  const session = await resolveOrganizationSession();
  const previousIds = new Set(previous.map((flow) => flow.id));
  for (const flow of next) {
    const row = flowToRow(flow, session.organizationId, session.userId);
    const { created_by: _createdBy, ...updateRow } = row;
    const { error } = previousIds.has(flow.id)
      ? await supabase.from('crm_campaigns').update(updateRow).eq('id', flow.id).eq('organization_id', session.organizationId)
      : await supabase.from('crm_campaigns').insert(row);
    if (error) throw error;
  }
  const archivedIds = previous.filter((flow) => !next.some((candidate) => candidate.id === flow.id)).map((flow) => flow.id);
  if (archivedIds.length) {
    const { error } = await supabase
      .from('crm_campaigns')
      .update({ status: 'archived' })
      .eq('organization_id', session.organizationId)
      .in('id', archivedIds);
    if (error) throw error;
  }
  return next;
}

export async function loadOperationalCatalog(): Promise<ProdutoCatalogo[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('crm_catalog_items')
    .select('id, code, name, category, unit, short_description, full_description, is_active, quote_enabled, maximum_discount, default_lead_time_days, base_unit_price')
    .eq('organization_id', session.organizationId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CatalogRow[]).map(rowToCatalog);
}

export async function persistOperationalCatalog(previous: ProdutoCatalogo[], next: ProdutoCatalogo[]): Promise<ProdutoCatalogo[]> {
  const session = await resolveOrganizationSession();
  const previousIds = new Set(previous.map((item) => item.id));
  for (const item of next) {
    const row = catalogToRow(item, session.organizationId, session.userId);
    const { created_by: _createdBy, ...updateRow } = row;
    const { error } = previousIds.has(item.id)
      ? await supabase.from('crm_catalog_items').update(updateRow).eq('id', item.id).eq('organization_id', session.organizationId)
      : await supabase.from('crm_catalog_items').insert(row);
    if (error) throw error;
  }
  const archivedIds = previous.filter((item) => !next.some((candidate) => candidate.id === item.id)).map((item) => item.id);
  if (archivedIds.length) {
    const { error } = await supabase
      .from('crm_catalog_items')
      .update({ is_archived: true, is_active: false })
      .eq('organization_id', session.organizationId)
      .in('id', archivedIds);
    if (error) throw error;
  }
  return next;
}

export const operationalEntityMappers = { rowToList, rowToFlow, rowToCatalog };
