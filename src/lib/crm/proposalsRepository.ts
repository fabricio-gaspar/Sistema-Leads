import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession, assertOrganizationSession, type OrganizationSession } from '@/lib/organizationSession';
import { isUuid } from '@/lib/crm/leadMapper';
import type { ItemProposta, Proposta } from '@/mocks/propostasData';
import { readAllPages } from './paginatedRead';

type JsonRecord = Record<string, unknown>;
interface ProposalRow {
  id: string; number: string; lead_id: string | null; client: string; items: unknown; value: number | string | null;
  discount: string | null; creator: string; creator_name: string | null; owner_id: string | null; status: string | null;
  need_approval: boolean | null; created_at: string; updated_at: string | null;
}
interface LeadRow { id: string; company: string; contact: string | null; }

const statusToDb: Record<Proposta['status'], string> = {
  rascunho: 'draft', aguardando_aprovacao: 'pending_approval', enviada: 'sent', visualizada: 'viewed',
  aceita: 'accepted', recusada: 'rejected', expirada: 'expired',
};
const statusFromDb: Record<string, Proposta['status']> = {
  draft: 'rascunho', pending: 'rascunho', pending_approval: 'aguardando_aprovacao', sent: 'enviada', viewed: 'visualizada',
  accepted: 'aceita', rejected: 'recusada', expired: 'expirada',
};

function number(value: unknown, fallback = 0): number { const parsed = typeof value === 'number' ? value : Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function string(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function extract(row: ProposalRow): { lines: ItemProposta[]; metadata: JsonRecord } {
  if (Array.isArray(row.items)) return { lines: row.items as ItemProposta[], metadata: {} };
  const value = row.items && typeof row.items === 'object' ? row.items as JsonRecord : {};
  return { lines: Array.isArray(value.lines) ? value.lines as ItemProposta[] : [], metadata: value.metadata && typeof value.metadata === 'object' ? value.metadata as JsonRecord : {} };
}
function payload(proposal: Proposta) {
  return {
    lines: proposal.itens.map((item) => ({ id: item.id, nome: item.nome, quantidade: item.quantidade, preco: item.preco, precoConfirmado: item.precoConfirmado === true })),
    metadata: {
      responsavel: proposal.responsavel, canal: proposal.canal, validade: proposal.validade, versao: proposal.versao,
      motivoPerda: proposal.motivoPerda ?? null, aprovador: proposal.aprovador ?? null, descontoAprovado: proposal.descontoAprovado ?? false,
      bloqueadaEnvio: proposal.bloqueadaEnvio ?? false, templateId: proposal.templateId ?? null, formaPagamento: proposal.formaPagamento ?? null,
      garantia: proposal.garantia ?? null, termos: proposal.termos ?? null, propostaPaiId: proposal.propostaPaiId ?? null,
    },
  };
}

export function persistentProposalId(id: string): string { return isUuid(id) ? id : crypto.randomUUID(); }
export function newProposalNumber(now = new Date(), random = crypto.randomUUID): string { return `PRP-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${random().replaceAll('-', '').slice(0, 6).toUpperCase()}`; }

function rowToProposal(row: ProposalRow, lead?: LeadRow): Proposta {
  const { lines, metadata } = extract(row);
  const dbStatus = row.status ?? 'draft';
  return {
    id: row.id, numero: row.number, lead: lead?.contact || 'Contato não informado', leadId: row.lead_id ?? undefined,
    empresa: lead?.company || row.client, valor: number(row.value), status: statusFromDb[dbStatus] ?? 'rascunho',
    validade: string(metadata.validade, row.created_at.slice(0, 10)), responsavel: string(metadata.responsavel, row.creator_name || 'Usuário'),
    data: row.created_at.slice(0, 10), createdAt: row.created_at, canal: string(metadata.canal, 'Manual'), itens: lines, descontoPct: number(row.discount),
    versao: Math.max(1, number(metadata.versao, 1)), motivoPerda: string(metadata.motivoPerda) || undefined,
    aprovador: string(metadata.aprovador) || undefined, propostaPaiId: string(metadata.propostaPaiId) || undefined,
    descontoAprovado: metadata.descontoAprovado === true, bloqueadaEnvio: metadata.bloqueadaEnvio === true,
    templateId: string(metadata.templateId) || undefined, formaPagamento: string(metadata.formaPagamento) || undefined,
    garantia: string(metadata.garantia) || undefined, termos: string(metadata.termos) || undefined,
  };
}

export async function loadOperationalProposals(organizationId?: string): Promise<Proposta[]> {
  const resolvedId = organizationId ?? (await resolveOrganizationSession()).organizationId;
  const rows = await readAllPages<ProposalRow>((from, to) => supabase.from('proposals')
    .select('id, number, lead_id, client, items, value, discount, creator, creator_name, owner_id, status, need_approval, created_at, updated_at')
    .eq('organization_id', resolvedId).neq('status', 'archived').order('id').range(from, to));
  const leadIds = [...new Set(rows.map((row) => row.lead_id).filter((id): id is string => Boolean(id)))];
  const leadById = new Map<string, LeadRow>();
  for (let index = 0; index < leadIds.length; index += 100) {
    const leads = await readAllPages<LeadRow>((from, to) => supabase.from('leads').select('id, company, contact').eq('organization_id', resolvedId).in('id', leadIds.slice(index, index + 100)).order('id').range(from, to));
    for (const lead of leads) leadById.set(lead.id, lead);
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((row) => rowToProposal(row, row.lead_id ? leadById.get(row.lead_id) : undefined));
}

async function save(proposal: Proposta, isNew: boolean, session: OrganizationSession): Promise<void> {
  assertOrganizationSession(session);
  if (!proposal.leadId || !isUuid(proposal.leadId)) throw new Error('proposal_lead_required');
  const values = {
    organization_id: session.organizationId, number: proposal.numero, lead_id: proposal.leadId, client: proposal.empresa,
    items: payload(proposal), value: proposal.valor, discount: String(proposal.descontoPct), creator: 'user',
    creator_name: proposal.responsavel, owner_id: session.userId, status: statusToDb[proposal.status],
    need_approval: proposal.status === 'aguardando_aprovacao', updated_at: new Date().toISOString(),
  };
  const request = isNew
    ? supabase.from('proposals').insert({ id: proposal.id, ...values })
    : supabase.from('proposals').update(values).eq('id', proposal.id).eq('organization_id', session.organizationId);
  const { error } = await request;
  if (error) throw error;
}

export async function persistOperationalProposals(previous: Proposta[], next: Proposta[]): Promise<Proposta[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const previousById = new Map(previous.map((proposal) => [proposal.id, proposal]));
  const persisted = next.map((proposal) => ({ ...proposal, id: persistentProposalId(proposal.id) }));
  const nextIds = new Set(persisted.map((proposal) => proposal.id));
  for (const proposal of persisted) await save(proposal, !previousById.has(proposal.id), session);
  for (const proposal of previous) {
    if (!nextIds.has(proposal.id) && isUuid(proposal.id)) {
      assertOrganizationSession(session);
      const { error } = await supabase.from('proposals').update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', proposal.id).eq('organization_id', session.organizationId);
      if (error) throw error;
    }
  }
  return persisted;
}

export const proposalMappers = { newProposalNumber, persistentProposalId, rowToProposal, proposalRowToProposal: rowToProposal };
export const proposalRowToProposal = rowToProposal;
